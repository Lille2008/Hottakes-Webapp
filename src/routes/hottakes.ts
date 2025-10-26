import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';

const createHottakeSchema = z.object({
  text: z.string().min(3),
  correct: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const hottakes = await prisma.hottake.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json(hottakes);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD is not configured');
    }

    const providedPassword = req.header('x-admin-password');
    if (providedPassword !== adminPassword) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const payload = createHottakeSchema.parse(req.body);
    const hottake = await prisma.hottake.create({
      data: {
        text: payload.text,
        correct: payload.correct ?? false,
        isActive: payload.isActive ?? true
      }
    });

    res.status(201).json(hottake);
  } catch (error) {
    next(error);
  }
});

export default router;
