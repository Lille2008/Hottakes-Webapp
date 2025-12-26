import { Router } from 'express';
import { z } from 'zod';

import prisma from '../../lib/db';
import { optionalAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';

const router = Router();

const dateSchema = z.union([z.coerce.date(), z.literal(null)]).optional();

const createGameDaySchema = z.object({
  description: z.string().min(3),
  startTime: dateSchema,
  lockTime: dateSchema,
  endTime: dateSchema,
  activeFlag: z.boolean().optional()
});

const updateGameDaySchema = z.object({
  description: z.string().min(3).optional(),
  startTime: dateSchema,
  lockTime: dateSchema,
  endTime: dateSchema,
  activeFlag: z.boolean().optional()
});

router.get('/active', async (_req, res, next) => {
  try {
    const active = await prisma.adminEvent.findFirst({
      where: { activeFlag: true },
      orderBy: { lockTime: 'desc' }
    });

    if (!active) {
      return res.status(404).json({ message: 'No active game day' });
    }

    return res.json(active);
  } catch (error) {
    return next(error);
  }
});

router.use(optionalAuth);
router.use(requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const events = await prisma.adminEvent.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json(events);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createGameDaySchema.parse(req.body);

    const created = await prisma.adminEvent.create({
      data: {
        description: payload.description,
        startTime: payload.startTime ?? null,
        lockTime: payload.lockTime ?? null,
        endTime: payload.endTime ?? null,
        activeFlag: payload.activeFlag ?? true
      }
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid game day id' });
    }

    const payload = updateGameDaySchema.parse(req.body);
    const data: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      data.description = payload.description;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'startTime')) {
      data.startTime = payload.startTime ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'lockTime')) {
      data.lockTime = payload.lockTime ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'endTime')) {
      data.endTime = payload.endTime ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'activeFlag')) {
      data.activeFlag = payload.activeFlag;
    }

    const updated = await prisma.adminEvent.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Game day not found' });
    }

    next(error);
  }
});

router.post('/:id/finalize', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid game day id' });
    }

    const updated = await prisma.adminEvent.update({
      where: { id },
      data: {
        activeFlag: false,
        endTime: new Date()
      }
    });

    res.json({ message: 'Game day finalized. Update hottake statuses individually.', gameDay: updated });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Game day not found' });
    }

    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid game day id' });
    }

    await prisma.adminEvent.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Game day not found' });
    }

    next(error);
  }
});

export default router;
