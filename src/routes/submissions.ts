import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { calculateScore, type HottakeOutcome } from '../lib/scoring';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { checkGameDayLock } from '../middleware/checkGameDayLock';

type HottakeWithStatus = { id: number; status: HottakeOutcome['status']; gameDay: number };

const submissionSchema = z.object({
  picks: z
    .array(z.number().int())
    .length(5)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'Picks müssen eindeutig sein.'
    })
});

const router = Router();

async function resolveGameDay(raw: unknown) {
  if (typeof raw === 'string' && raw.length > 0) {
    if (raw === 'active') {
      const active = await prisma.adminEvent.findFirst({ where: { activeFlag: true }, orderBy: { lockTime: 'desc' } });
      if (!active) {
        throw new Error('Kein aktiver Spieltag vorhanden.');
      }
      return active.gameDay;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      throw new Error('Ungültiger Spieltag-Parameter');
    }
    return parsed;
  }

  const active = await prisma.adminEvent.findFirst({ where: { activeFlag: true }, orderBy: { lockTime: 'desc' } });
  if (!active) {
    throw new Error('Kein aktiver Spieltag vorhanden.');
  }
  return active.gameDay;
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

  const score = calculateScore(submission.picks, mappedHottakes);

  if (score !== submission.score) {
    await prisma.submission.update({
      where: { userId_gameDay: { userId, gameDay } },
      data: { score }
    });
  }

  return {
    nickname,
    picks: submission.picks,
    score,
    submittedAt: submission.updatedAt,
    gameDay
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { nickname, userId } = req.query;
    const currentUser = (req as AuthRequest).user;
    const gameDay = await resolveGameDay(req.query.gameDay);

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
    const gameDay = await resolveGameDay(req.query.gameDay);

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
    const gameDay = await resolveGameDay(req.query.gameDay);

    if (!currentUser) {
      return res.status(401).json({ message: 'Authentifizierung erforderlich.' });
    }

    const selectedHottakes = await prisma.hottake.findMany({
      where: { id: { in: payload.picks }, gameDay },
      select: { id: true, status: true, gameDay: true }
    });

    if (selectedHottakes.length !== payload.picks.length) {
      return res.status(400).json({ message: 'Ungültige Picks gefunden (falscher Spieltag oder unbekannte IDs).' });
    }

    if (selectedHottakes.some((hot: HottakeWithStatus) => hot.status !== 'OFFEN')) {
      return res.status(400).json({ message: 'Alle Picks müssen offene Hottakes sein.' });
    }

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });

    if (!user) {
      return res.status(404).json({ message: 'User nicht gefunden.' });
    }

    const submission = await prisma.submission.upsert({
      where: { userId_gameDay: { userId: user.id, gameDay } },
      update: { picks: payload.picks },
      create: { picks: payload.picks, userId: user.id, gameDay }
    });

    const mappedHottakes: HottakeOutcome[] = selectedHottakes.map(
      (hot: HottakeWithStatus): HottakeOutcome => ({
        id: hot.id,
        status: hot.status
      })
    );

    const score = calculateScore(submission.picks, mappedHottakes);

    if (score !== submission.score) {
      await prisma.submission.update({
        where: { userId_gameDay: { userId: user.id, gameDay } },
        data: { score }
      });
    }

    res.status(201).json({
      nickname: user.nickname,
      picks: submission.picks,
      score,
      submittedAt: submission.updatedAt,
      gameDay
    });
  } catch (error) {
    next(error);
  }
});

export default router;
