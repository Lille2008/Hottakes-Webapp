// Zentrale Express-App: registriert Middleware, API-Routen und das Static-Hosting der Frontend-Dateien.
// Diese Datei kennt keine Port/Listen-Logik – das passiert in src/server.ts.
// Fehler werden am Ende über eine zentrale Error-Middleware behandelt (inkl. Zod-Validierungsfehlern).
import path from 'node:path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';

import hottakesRouter from './routes/hottakes';
import submissionsRouter from './routes/submissions';
import leaderboardRouter from './routes/leaderboard';
import healthRouter from './routes/health';

// Neue Express-Anwendung erstellen
const app = express();

// Allgemeine Middleware
app.use(cors()); // erlaubt Cross-Origin-Anfragen (Frontend <-> API)
app.use(express.json()); // parst JSON-Request-Bodies
app.use('/api/hottakes', hottakesRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/health', healthRouter);
app.use('/health', healthRouter);

// Fallback für nicht definierte API-Endpunkte
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Statische Dateien (Frontend) ausliefern
app.use(express.static(path.join(__dirname, '..', 'public')));

// Single-Page-App-Fallback: Alle nicht-API GET-Routen bekommen index.html
app.get('*', (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }

  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// Zentrale Fehlerbehandlung – wandelt Validierungsfehler und sonstige Fehler in HTTP-Antworten um
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

// Export der App – wird in src/server.ts importiert und dort gebootet
export default app;
export { app };
