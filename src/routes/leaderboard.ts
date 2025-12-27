import { Router } from 'express';

import { buildLeaderboard, buildLeaderboardAll } from '../lib/leaderboard';
import { resolveGameDayParam } from '../lib/gameDay';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const raw = req.query.gameDay;

    if (raw === undefined || raw === null || raw === 'all') {
      const entries = await buildLeaderboardAll();
      return res.json(entries);
    }

    const gameDay = await resolveGameDayParam(raw);
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
