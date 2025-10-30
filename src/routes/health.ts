// Health-Endpoint: Ermöglicht ein schnelles "Lebt der Prozess?"-Signal für Liveness/Readiness-Checks.
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({ ok: true });
});

export default router;
