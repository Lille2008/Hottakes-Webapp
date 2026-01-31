import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { optionalAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { GAME_DAY_STATUS, getGameDayByNumber, resolveGameDayParam } from '../lib/gameDay';

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
    const gameDayNumber = await resolveGameDayParam(rawGameDay);

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
    const targetGameDay = typeof payload.gameDay === 'number' ? payload.gameDay : await resolveGameDayParam('active');
    const gameDay = await getGameDayByNumber(targetGameDay);

    // Hottakes can be created for upcoming (PENDING) and current (ACTIVE) game days.
    // Finished days must be immutable to keep history consistent.
    if (gameDay.status !== GAME_DAY_STATUS.PENDING && gameDay.status !== GAME_DAY_STATUS.ACTIVE) {
      return res.status(400).json({ message: 'Spieltag ist abgeschlossen oder archiviert. Keine neuen Hottakes möglich.' });
    }

    const existingCount = await prisma.hottake.count({ where: { gameDay: targetGameDay } });
    if (existingCount >= 10) {
      return res.status(400).json({ message: 'Maximal 10 Hottakes pro Spieltag erlaubt.' });
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

    const updated = await prisma.$transaction(async (tx) => {
      const hottake = await tx.hottake.update({
        where: { id },
        data: { status: payload.status }
      });

      const hottakes = await tx.hottake.findMany({ where: { gameDay: hottake.gameDay }, select: { status: true } });
      const total = hottakes.length;
      const openCount = hottakes.filter((entry) => entry.status === 'OFFEN').length;

      if (total === 10 && openCount === 0) {
        await tx.gameDay.update({
          where: { gameDay: hottake.gameDay },
          data: { status: GAME_DAY_STATUS.FINALIZED, finalizedAt: new Date() }
        });
      }

      return hottake;
    });

    res.json(updated);
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
