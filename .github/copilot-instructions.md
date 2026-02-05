# Project Guidelines

## Code Style
- UI text is German only; code comments and explanations stay in English so the user can learn terms.
- Keep explanations short and beginner-friendly; encourage the user to try changes and understand them.
- Add comments sparingly and only to clarify non-obvious logic.

## Architecture
- Express app wiring lives in [src/app.ts]; do not call `listen()` there.
- Server start and scheduler boot live in [src/server.ts].
- Static SPA is served from [public] with the SPA fallback in [src/app.ts].
- Prisma client is a singleton in [src/lib/db.ts] (maps `DB_URL` to `DATABASE_URL`).

## Build and Test
- Dev: `npm run dev` (ts-node-dev, starts [src/server.ts]).
- Build: `npm run build` (tsc to `dist/`, copies `public/`).
- Start: `npm start` (node `dist/server.js`).
- Tests: `npm test` (Jest + Testcontainers, see [tests/setup.ts]).
- Ops script: `npm run fix:submission-constraint` for legacy DB constraint fixes.

## Project Conventions
- Update the KI-Dialog log in [README.md] with date + short notes for new insights or open questions.
- Submissions require exactly 3 ranked picks and 10 swipe decisions, and only for `PENDING`/`ACTIVE` game days; see [src/routes/submissions.ts].
- Hottakes are limited to 10 per game day and only modifiable for `PENDING`/`ACTIVE`; see [src/routes/hottakes.ts].
- Scoring uses rank bonuses and swipe hits in [src/lib/scoring.ts].

## Integration Points
- PostgreSQL via Prisma; deployed on Render with Supabase DB (use `DATABASE_URL`).
- Frontend calls `/api` with cookies; main client logic in [public/src/app.js].

## Security
- JWT auth is stored in an HttpOnly cookie (`token`) in [src/routes/auth.ts].
- Optional Basic Auth gate via `APP_PASSWORD` + `hottakes_basic_auth` cookie in [src/app.ts].
- Password reset uses `resetToken` + expiry in [src/routes/auth.ts].

If anything is unclear, suggest a concrete addition with a file path.
