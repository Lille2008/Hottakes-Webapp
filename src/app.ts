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
import publicGameDaysRouter from './routes/gameDays';

// Basic Auth Middleware (global, vor öffentlichem Zugriff)
const APP_PASSWORD = process.env.APP_PASSWORD;
const BASIC_AUTH_COOKIE = 'hottakes_basic_auth'; // Cookie für Basic Auth

const basicAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!APP_PASSWORD) return next(); // Ohne gesetztes Passwort wird Auth übersprungen (Dev-Zwecke)

  if (req.cookies?.[BASIC_AUTH_COOKIE] === '1') { // Bereits authentifiziert (Auth wird übersprungen)
    return next();
  }

  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) { 
    res.setHeader('WWW-Authenticate', 'Basic realm="Hottakes"');
    return res.status(401).send('Passwort benötigt');
  }

  const b64 = auth.split(' ')[1]; // Passwortteil extrahieren
  const userpass = Buffer.from(b64, 'base64').toString('utf8');
  const idx = userpass.indexOf(':');
  const pass = idx >= 0 ? userpass.slice(idx + 1) : '';

  if (pass !== APP_PASSWORD) { // Passwort wird überprüft
    res.setHeader('WWW-Authenticate', 'Basic realm="Hottakes"');
    return res.status(401).send('Falsches Passwort');
  }

  res.cookie(BASIC_AUTH_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  });

  next();
};

const app = express();

app.use(cookieParser());
app.use(basicAuth);
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/hottakes', hottakesRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/health', healthRouter);
app.use('/health', healthRouter);
app.use('/api/admin/game-days', gameDaysRouter);
app.use('/api/game-days', publicGameDaysRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Nicht gefunden' });
});

const publicRoot = path.join(__dirname, '..', 'public');

const sendPublicFile = (res: Response, fileName: string) => {
  res.sendFile(path.join(publicRoot, fileName));
};

app.get('/', (_req, res) => sendPublicFile(res, 'guest.html'));
app.get('/guest', (_req, res) => sendPublicFile(res, 'guest.html'));
app.get('/spieltag', (_req, res) => sendPublicFile(res, 'spieltag.html'));
app.get('/leaderboard', (_req, res) => sendPublicFile(res, 'leaderboard.html'));
app.get('/profil', (_req, res) => sendPublicFile(res, 'profil.html'));
app.get('/admin', (_req, res) => sendPublicFile(res, 'admin.html'));

app.get('/login', (_req, res) => sendPublicFile(res, 'login.html'));
app.get('/register', (_req, res) => sendPublicFile(res, 'register.html'));
app.get('/forgot-password', (_req, res) => sendPublicFile(res, 'forgot-password.html'));
app.get('/reset-password', (_req, res) => sendPublicFile(res, 'reset-password.html'));
app.get('/impressum', (_req, res) => sendPublicFile(res, 'impressum.html'));
app.get('/datenschutz', (_req, res) => sendPublicFile(res, 'datenschutz.html'));

app.use(express.static(publicRoot));

app.get('*', (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }

  return res.sendFile(path.join(publicRoot, 'spieltag.html'));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validierung fehlgeschlagen',
      issues: error.issues
    });
  }

  if (error instanceof Error) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Unerwarteter Fehler' });
});

export default app;
export { app };
