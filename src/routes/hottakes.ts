import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { optionalAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const STATUS_VALUES = ['OFFEN', 'WAHR', 'FALSCH'] as const;

const createHottakeSchema = z.object({
  text: z.string().min(3),
  status: z.enum(STATUS_VALUES).optional(),
  gameDay: z.number().int().nonnegative().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES)
});

const router = Router();

router.get('/', async (req, res, next) => {
  const archived = req.query.archived;
  const rawGameDay = req.query.gameDay;
  try {
    let gameDayNumber: number | null = null;

    if (typeof rawGameDay === 'string' && rawGameDay.length > 0) {
      if (rawGameDay === 'active') {
        const active = await prisma.adminEvent.findFirst({ where: { activeFlag: true }, orderBy: { lockTime: 'desc' } });
        if (!active) {
          return res.status(404).json({ message: 'Kein aktiver Spieltag vorhanden.' });
        }
        gameDayNumber = active.gameDay;
      } else {
        const parsed = Number.parseInt(rawGameDay, 10);
        if (Number.isNaN(parsed)) {
          return res.status(400).json({ message: 'Ungültiger Spieltag-Parameter' });
        }
        gameDayNumber = parsed;
      }
    } else {
      const active = await prisma.adminEvent.findFirst({ where: { activeFlag: true }, orderBy: { lockTime: 'desc' } });
      gameDayNumber = active?.gameDay ?? null;
    }

    if (gameDayNumber === null) {
      return res.status(404).json({ message: 'Kein Spieltag gefunden.' });
    }

    const hottakes = await prisma.hottake.findMany({
      where:
        archived === 'all'
          ? { gameDay: gameDayNumber }
          : archived === 'true'
            ? { status: { not: 'OFFEN' }, gameDay: gameDayNumber }
            : { status: 'OFFEN', gameDay: gameDayNumber },
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

    let targetGameDay = payload.gameDay;
    if (typeof targetGameDay !== 'number') {
      const active = await prisma.adminEvent.findFirst({ where: { activeFlag: true }, orderBy: { lockTime: 'desc' } });
      if (!active) {
        return res.status(400).json({ message: 'Kein aktiver Spieltag vorhanden. Bitte lege zuerst einen Spieltag an.' });
      }
      targetGameDay = active.gameDay;
    }

    const gameDayExists = await prisma.adminEvent.findUnique({ where: { gameDay: targetGameDay } });
    if (!gameDayExists) {
      return res.status(400).json({ message: 'Angegebener Spieltag existiert nicht.' });
    }

    const hottake = await prisma.hottake.create({
      data: {
        text: payload.text,
        status: payload.status ?? 'OFFEN',
        gameDay: targetGameDay
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
      return res.status(400).json({ message: 'Ungültige Hottake-ID' });
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
      return res.status(404).json({ message: 'Hottake nicht gefunden' });
    }

    next(error);
  }
});

export default router;
