import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { optionalAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const STATUS_VALUES = ['OFFEN', 'WAHR', 'FALSCH'] as const;

const createHottakeSchema = z.object({
  text: z.string().min(3),
  status: z.enum(STATUS_VALUES).optional()
});

const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES)
});

const router = Router();

router.get('/', async (req, res, next) => {
  const archived = req.query.archived;
  try {
    const hottakes = await prisma.hottake.findMany({
      where:
        archived === 'all'
          ? undefined
          : archived === 'true'
            ? { status: { not: 'OFFEN' } }
            : { status: 'OFFEN' },
      orderBy: { createdAt: 'asc' }
    });
    res.json(hottakes);
  } catch (error) {
    next(error);
  }
});

router.use(optionalAuth);

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const payload = createHottakeSchema.parse(req.body);
    const hottake = await prisma.hottake.create({
      data: {
        text: payload.text,
        status: payload.status ?? 'OFFEN'
      }
    });

    res.status(201).json(hottake);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid hottake id' });
    }

    const payload = updateStatusSchema.parse(req.body);

    const hottake = await prisma.hottake.update({
      where: { id },
      data: { status: payload.status }
    });

    res.json(hottake);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Hottake not found' });
    }

    next(error);
  }
});

export default router;
