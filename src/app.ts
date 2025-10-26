import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import healthRouter from './routes/health';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/health', healthRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Unexpected error' });
});

export default app;
