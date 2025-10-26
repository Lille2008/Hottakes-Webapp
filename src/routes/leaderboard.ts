import { Router } from 'express';

import { buildLeaderboard } from '../lib/leaderboard';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const entries = await buildLeaderboard();
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

export default router;
