import { Router } from 'express';
import prisma from '../lib/db';
import { findCurrentGameDayNumber } from '../lib/gameDay';

const router = Router();

router.get('/active', async (_req, res, next) => {
  try {
    const currentGameDay = await findCurrentGameDayNumber();

    if (currentGameDay === null) {
      return res.status(404).json({ message: 'Kein aktiver Spieltag vorhanden.' });
    }

    const active = await prisma.adminEvent.findUnique({ where: { gameDay: currentGameDay } });

    if (!active) {
      return res.status(404).json({ message: 'Kein aktiver Spieltag vorhanden.' });
    }

    return res.json(active);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const events = await prisma.adminEvent.findMany({
      orderBy: { gameDay: 'asc' }
    });

    res.json(events);
  } catch (error) {
    next(error);
  }
});

export default router;
