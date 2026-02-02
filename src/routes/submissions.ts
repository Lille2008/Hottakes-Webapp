import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { calculateScore, type HottakeOutcome, type SwipeDecision } from '../lib/scoring';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { checkGameDayLock } from '../middleware/checkGameDayLock';
import { GAME_DAY_STATUS, getGameDayByNumber, resolveGameDayParam } from '../lib/gameDay';

type HottakeWithStatus = { id: number; status: HottakeOutcome['status']; gameDay: number };

const swipeDecisionSchema = z.object({
  hottakeId: z.number().int(),
  decision: z.enum(['hit', 'pass', 'skip'])
});

const submissionSchema = z.object({
  picks: z
    .array(z.number().int())
    .length(3)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'Picks müssen eindeutig sein.'
    }),
  swipeDecisions: z
    .array(swipeDecisionSchema)
    .length(10)
    .refine((arr) => new Set(arr.map((entry) => entry.hottakeId)).size === arr.length, {
      message: 'Swipe-Entscheidungen müssen eindeutig sein.'
    })
});

const router = Router();

function isPrismaUniqueConstraintError(error: unknown): error is { code: string; meta?: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

async function buildSubmissionResponse(userId: number, nickname: string, gameDay: number) {
  const [submission, hottakes] = await Promise.all([
    prisma.submission.findUnique({ where: { userId_gameDay: { userId, gameDay } } }),
    prisma.hottake.findMany({ where: { gameDay }, select: { id: true, status: true, gameDay: true } })
  ]);

  if (!submission) {
    return null;
  }

  const mappedHottakes: HottakeOutcome[] = hottakes.map((hot: HottakeWithStatus): HottakeOutcome => ({
    id: hot.id,
    status: hot.status
  }));

  const storedDecisions = Array.isArray(submission.swipeDecisions)
    ? (submission.swipeDecisions as SwipeDecision[])
    : [];
  const score = calculateScore(submission.picks, mappedHottakes, storedDecisions);

  if (score !== submission.score) {
    await prisma.submission.update({
      where: { userId_gameDay: { userId, gameDay } },
      data: { score }
    });
  }

  return {
    nickname,
    picks: submission.picks,
    swipeDecisions: storedDecisions,
    score,
    submittedAt: submission.updatedAt,
    gameDay
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { nickname, userId } = req.query;
    const currentUser = (req as AuthRequest).user;
    const gameDay = await resolveGameDayParam(req.query.gameDay);

    if (!currentUser) {
      return res.status(401).json({ message: 'Authentifizierung erforderlich.' });
    }

    if (!nickname && !userId) {
      return res.status(400).json({ message: 'nickname oder userId erforderlich.' });
    }

    if (nickname && typeof nickname === 'string') {
      if (nickname !== currentUser.nickname) {
        return res.status(403).json({ message: 'Nicht erlaubt.' });
      }

      const user = await prisma.user.findUnique({ where: { nickname } });
      if (!user) {
        return res.status(404).json({ message: 'Submission nicht gefunden.' });
      }

      const response = await buildSubmissionResponse(user.id, user.nickname, gameDay);
      if (!response) {
        return res.status(404).json({ message: 'Submission nicht gefunden.' });
      }

      return res.json(response);
    }

    if (userId && typeof userId === 'string') {
      const parsedId = Number.parseInt(userId, 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: 'userId muss numerisch sein.' });
      }

      if (parsedId !== currentUser.id) {
        return res.status(403).json({ message: 'Nicht erlaubt.' });
      }

      const user = await prisma.user.findUnique({ where: { id: parsedId } });
      if (!user) {
        return res.status(404).json({ message: 'Submission nicht gefunden.' });
      }

      const response = await buildSubmissionResponse(user.id, user.nickname, gameDay);
      if (!response) {
        return res.status(404).json({ message: 'Submission nicht gefunden.' });
      }

      return res.json(response);
    }

    return res.status(400).json({ message: 'Ungültige Anfrageparameter.' });
  } catch (error) {
    next(error);
  }
});

router.get('/:nickname', requireAuth, async (req, res, next) => {
  try {
    const currentUser = (req as AuthRequest).user;
    const { nickname } = req.params;
    const gameDay = await resolveGameDayParam(req.query.gameDay);

    if (!currentUser || nickname !== currentUser.nickname) {
      return res.status(403).json({ message: 'Nicht erlaubt.' });
    }

    const user = await prisma.user.findUnique({ where: { nickname } });

    if (!user) {
      return res.status(404).json({ message: 'Submission nicht gefunden.' });
    }

    const response = await buildSubmissionResponse(user.id, user.nickname, gameDay);

    if (!response) {
      return res.status(404).json({ message: 'Submission nicht gefunden.' });
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, checkGameDayLock, async (req, res, next) => {
  try {
    const payload = submissionSchema.parse(req.body);
    const currentUser = (req as AuthRequest).user;
    const gameDay = await resolveGameDayParam(req.query.gameDay);

    if (!currentUser) {
      return res.status(401).json({ message: 'Authentifizierung erforderlich.' });
    }

    const gameDayEvent = await getGameDayByNumber(gameDay);
    // We allow saving picks while a game day is upcoming (PENDING) or current (ACTIVE).
    // Finished days must be immutable so history/leaderboard stays consistent.
    if (gameDayEvent.status !== GAME_DAY_STATUS.ACTIVE && gameDayEvent.status !== GAME_DAY_STATUS.PENDING) {
      return res.status(400).json({ message: 'Spieltag ist abgeschlossen oder archiviert. Keine Änderungen mehr möglich.' });
    }

    const openHottakes = await prisma.hottake.findMany({
      where: { gameDay, status: 'OFFEN' },
      select: { id: true, status: true, gameDay: true }
    });

    if (openHottakes.length !== 10) {
      return res
        .status(400)
        .json({ message: `Es müssen genau 10 offene Hottakes vorhanden sein. Aktuell: ${openHottakes.length}.` });
    }

    const openIds = new Set(openHottakes.map((hot) => hot.id));
    const decisionIds = new Set(payload.swipeDecisions.map((entry) => entry.hottakeId));

    if (decisionIds.size !== openIds.size || Array.from(openIds).some((id) => !decisionIds.has(id))) {
      return res.status(400).json({ message: 'Swipe-Entscheidungen müssen alle 10 offenen Hottakes enthalten.' });
    }

    if (payload.picks.some((pickId) => !openIds.has(pickId))) {
      return res.status(400).json({ message: 'Alle Picks müssen offene Hottakes sein.' });
    }

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });

    if (!user) {
      return res.status(404).json({ message: 'User nicht gefunden.' });
    }

    let submission;
    try {
      submission = await prisma.submission.upsert({
        where: { userId_gameDay: { userId: user.id, gameDay } },
        update: { picks: payload.picks, swipeDecisions: payload.swipeDecisions },
        create: { picks: payload.picks, swipeDecisions: payload.swipeDecisions, userId: user.id, gameDay }
      });
    } catch (error) {
      // If the DB still has a legacy UNIQUE(userId) constraint/index,
      // a user cannot store submissions for multiple game days.
      // We return a clear error so the fix is actionable in production.
      if (isPrismaUniqueConstraintError(error) && error.code === 'P2002') {
        return res.status(409).json({
          message:
            'Datenbank-Constraint blockiert das Speichern. Vermutlich existiert noch eine alte UNIQUE-Constraint nur auf submissions.userId. Bitte entferne UNIQUE(userId) und stelle UNIQUE(userId, gameDay) sicher.'
        });
      }

      throw error;
    }

    const mappedHottakes: HottakeOutcome[] = openHottakes.map(
      (hot: HottakeWithStatus): HottakeOutcome => ({
        id: hot.id,
        status: hot.status
      })
    );

    const score = calculateScore(submission.picks, mappedHottakes, payload.swipeDecisions);

    if (score !== submission.score) {
      await prisma.submission.update({
        where: { userId_gameDay: { userId: user.id, gameDay } },
        data: { score }
      });
    }

    res.status(201).json({
      nickname: user.nickname,
      picks: submission.picks,
      swipeDecisions: payload.swipeDecisions,
      score,
      submittedAt: submission.updatedAt,
      gameDay
    });
  } catch (error) {
    next(error);
  }
});

export default router;
