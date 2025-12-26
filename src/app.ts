import path from 'node:path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';

import cookieParser from 'cookie-parser';

import hottakesRouter from './routes/hottakes';
import submissionsRouter from './routes/submissions';
import leaderboardRouter from './routes/leaderboard';
import authRouter from './routes/auth';
import healthRouter from './routes/health';
import gameDaysRouter from './routes/admin/gameDays';

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/hottakes', hottakesRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/health', healthRouter);
app.use('/health', healthRouter);
app.use('/api/admin/game-days', gameDaysRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }

  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      issues: error.issues
    });
  }

  if (error instanceof Error) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Unexpected error' });
});

export default app;
export { app };
