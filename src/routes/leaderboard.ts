import { Router } from 'express';

import { buildLeaderboard } from '../lib/leaderboard';
import prisma from '../lib/db';

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

router.get('/', async (req, res, next) => {
  try {
    const gameDay = await resolveGameDay(req.query.gameDay);
    const entries = await buildLeaderboard(gameDay);
    res.json(entries);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Spieltag')) {
      const status = error.message.includes('Ungültiger') ? 400 : 404;
      return res.status(status).json({ message: error.message });
    }
    next(error);
  }
});

export default router;
