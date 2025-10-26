import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { calculateScore, type HottakeOutcome } from '../lib/scoring';

type HottakeWithStatus = { id: number; status: HottakeOutcome['status'] };

const submissionSchema = z.object({
  nickname: z.string().min(2),
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

router.get('/', async (req, res, next) => {
  try {
    const { nickname, userId } = req.query;

    if (!nickname && !userId) {
      return res.status(400).json({ message: 'nickname or userId required' });
    }

    if (nickname && typeof nickname === 'string') {
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

router.get('/:nickname', async (req, res, next) => {
  try {
    const { nickname } = req.params;
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

router.post('/', async (req, res, next) => {
  try {
    const payload = submissionSchema.parse(req.body);

    const [selectedHottakes, openCount] = await Promise.all([
      prisma.hottake.findMany({
        where: { id: { in: payload.picks } },
        select: { id: true, status: true }
      }),
      prisma.hottake.count({ where: { status: 'OFFEN' } })
    ]);

    if (selectedHottakes.length !== payload.picks.length) {
      return res.status(400).json({ message: 'Invalid picks detected' });
    }

    if (openCount < 10) {
      return res.status(409).json({ message: 'Es müssen mindestens 10 offene Hottakes verfügbar sein.' });
    }

    if (selectedHottakes.some((hot: HottakeWithStatus) => hot.status !== 'OFFEN')) {
      return res.status(400).json({ message: 'Alle Picks müssen offene Hottakes sein.' });
    }

    const user = await prisma.user.upsert({
      where: { nickname: payload.nickname },
      update: {},
      create: { nickname: payload.nickname }
    });

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
