import { Router } from 'express';
import { z } from 'zod';

import prisma from '../../lib/db';
import { optionalAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { GAME_DAY_STATUS, findCurrentGameDayNumber } from '../../lib/gameDay';

const router = Router();

const dateSchema = z.union([z.coerce.date(), z.literal(null)]).optional();

const statusSchema = z.enum([GAME_DAY_STATUS.PENDING, GAME_DAY_STATUS.ACTIVE, GAME_DAY_STATUS.FINALIZED, GAME_DAY_STATUS.ARCHIVED]);

const createGameDaySchema = z.object({
  description: z.string().min(3),
  startTime: dateSchema,
  lockTime: dateSchema,
  finalizedAt: dateSchema,
  status: statusSchema.optional(),
  gameDay: z.number().int().nonnegative().optional()
});

const updateGameDaySchema = z.object({
  description: z.string().min(3).optional(),
  startTime: dateSchema,
  lockTime: dateSchema,
  finalizedAt: dateSchema,
  status: statusSchema.optional(),
  gameDay: z.number().int().nonnegative().optional()
});

router.get('/active', async (_req, res, next) => {
  try {
    const currentGameDay = await findCurrentGameDayNumber();
    if (currentGameDay === null) {
      return res.status(404).json({ message: 'Kein aktiver Spieltag vorhanden.' });
    }

    const active = await prisma.gameDay.findUnique({ where: { gameDay: currentGameDay } });

    if (!active) {
      return res.status(404).json({ message: 'Kein aktiver Spieltag vorhanden.' });
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
    const events = await prisma.gameDay.findMany({
      orderBy: { gameDay: 'asc' }
    });

    res.json(events);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createGameDaySchema.parse(req.body);

    const nextGameDay =
      payload.gameDay ??
      ((await prisma.gameDay.aggregate({ _max: { gameDay: true } }))._max.gameDay ?? -1) + 1;

    const created = await prisma.gameDay.create({
      data: {
        description: payload.description,
        startTime: payload.startTime ?? null,
        lockTime: payload.lockTime ?? null,
        finalizedAt: payload.finalizedAt ?? null,
        status: payload.status ?? GAME_DAY_STATUS.PENDING,
        gameDay: nextGameDay
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
      return res.status(400).json({ message: 'Ungültige Spieltag-ID' });
    }

    const existing = await prisma.gameDay.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Spieltag nicht gefunden' });
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

    if (Object.prototype.hasOwnProperty.call(payload, 'finalizedAt')) {
      data.finalizedAt = payload.finalizedAt ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
      data.status = payload.status;

      if (
        payload.status === GAME_DAY_STATUS.FINALIZED &&
        !Object.prototype.hasOwnProperty.call(payload, 'finalizedAt')
      ) {
        data.finalizedAt = existing.finalizedAt ?? new Date();
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'gameDay') && typeof payload.gameDay === 'number') {
      data.gameDay = payload.gameDay;
    }

    const now = new Date();
    if (
      existing.lockTime &&
      existing.lockTime <= now &&
      Object.prototype.hasOwnProperty.call(payload, 'lockTime') &&
      payload.lockTime &&
      payload.lockTime.getTime() !== existing.lockTime.getTime()
    ) {
      return res.status(400).json({ message: 'Lock-Time kann nach Eintritt nicht mehr geändert werden.' });
    }

    const updated = await prisma.gameDay.update({
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
      return res.status(404).json({ message: 'Spieltag nicht gefunden' });
    }

    next(error);
  }
});

router.post('/:id/finalize', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Ungültige Spieltag-ID' });
    }

    const updated = await prisma.gameDay.update({
      where: { id },
      data: {
        status: GAME_DAY_STATUS.FINALIZED,
        finalizedAt: new Date()
      }
    });

    res.json({ message: 'Spieltag abgeschlossen. Hottake-Status bitte separat pflegen.', gameDay: updated });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Spieltag nicht gefunden' });
    }

    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Ungültige Spieltag-ID' });
    }

    await prisma.gameDay.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Spieltag nicht gefunden' });
    }

    next(error);
  }
});

export default router;
