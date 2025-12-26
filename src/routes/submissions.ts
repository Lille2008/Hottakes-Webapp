import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { calculateScore, type HottakeOutcome } from '../lib/scoring';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { checkGameDayLock } from '../middleware/checkGameDayLock';

type HottakeWithStatus = { id: number; status: HottakeOutcome['status'] };

const submissionSchema = z.object({
  picks: z
    .array(z.number().int())
    .length(5)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'Picks must be unique'
    })
});

const router = Router();

async function buildSubmissionResponse(userId: number, nickname: string) {
  const [submission, hottakes] = await Promise.all([
    prisma.submission.findUnique({ where: { userId } }),
    prisma.hottake.findMany({ select: { id: true, status: true } })
  ]);

  if (!submission) {
    return null;
  }

  const mappedHottakes: HottakeOutcome[] = hottakes.map((hot: HottakeWithStatus): HottakeOutcome => ({
    id: hot.id,
    status: hot.status
  }));

  const score = calculateScore(submission.picks, mappedHottakes);

  return {
    nickname,
    picks: submission.picks,
    score,
    submittedAt: submission.updatedAt
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { nickname, userId } = req.query;
    const currentUser = (req as AuthRequest).user;

    if (!currentUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!nickname && !userId) {
      return res.status(400).json({ message: 'nickname or userId required' });
    }

    if (nickname && typeof nickname === 'string') {
      if (nickname !== currentUser.nickname) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const user = await prisma.user.findUnique({ where: { nickname } });
      if (!user) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const response = await buildSubmissionResponse(user.id, user.nickname);
      if (!response) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      return res.json(response);
    }

    if (userId && typeof userId === 'string') {
      const parsedId = Number.parseInt(userId, 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: 'userId must be numeric' });
      }

      if (parsedId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const user = await prisma.user.findUnique({ where: { id: parsedId } });
      if (!user) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const response = await buildSubmissionResponse(user.id, user.nickname);
      if (!response) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      return res.json(response);
    }

    return res.status(400).json({ message: 'Invalid query parameters' });
  } catch (error) {
    next(error);
  }
});

router.get('/:nickname', requireAuth, async (req, res, next) => {
  try {
    const currentUser = (req as AuthRequest).user;
    const { nickname } = req.params;

    if (!currentUser || nickname !== currentUser.nickname) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({ where: { nickname } });

    if (!user) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const response = await buildSubmissionResponse(user.id, user.nickname);

    if (!response) {
      return res.status(404).json({ message: 'Submission not found' });
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

    if (!currentUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const selectedHottakes = await prisma.hottake.findMany({
      where: { id: { in: payload.picks } },
      select: { id: true, status: true }
    });

    if (selectedHottakes.length !== payload.picks.length) {
      return res.status(400).json({ message: 'Invalid picks detected' });
    }

    if (selectedHottakes.some((hot: HottakeWithStatus) => hot.status !== 'OFFEN')) {
      return res.status(400).json({ message: 'Alle Picks müssen offene Hottakes sein.' });
    }

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const submission = await prisma.submission.upsert({
      where: { userId: user.id },
      update: { picks: payload.picks },
      create: { picks: payload.picks, userId: user.id }
    });

    const mappedHottakes: HottakeOutcome[] = selectedHottakes.map(
      (hot: HottakeWithStatus): HottakeOutcome => ({
        id: hot.id,
        status: hot.status
      })
    );

    const score = calculateScore(submission.picks, mappedHottakes);

    res.status(201).json({
      nickname: user.nickname,
      picks: submission.picks,
      score,
      submittedAt: submission.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

export default router;
