# Hottakes – AI Coding Agent Guide

This document gives AI coding agents the essential, repo-specific context to be productive immediately. Prefer concrete patterns from this codebase over generic best practices.

## Architecture Overview
- Backend: TypeScript + Express API in `src/`. App wiring lives in `src/app.ts`; process startup is isolated in `src/server.ts`.
- Frontend: Static SPA served from `public/` (vanilla JS in `public/src/app.js`). The API is expected under the `/api` prefix and uses cookie-based JWT auth.
- Data: PostgreSQL via Prisma. Client is created once and reused from `src/lib/db.ts` (singleton in dev to avoid multiple connections).
- Domain: “Hottakes” users pick 5 open predictions; scores are computed from actual outcomes and shown in a leaderboard.

## Data Model (Prisma)
- Schema in `prisma/schema.prisma`. Key models:
  - `Hottake { id, text, status: OFFEN|WAHR|FALSCH, createdAt, updatedAt }`
  - `User { id, nickname(unique), email, passwordHash, prefs Json? default "{}", submission? }`
  - `Submission { id, userId(unique), picks: Int[], createdAt, updatedAt }`
  - `Setting` and `AdminEvent` exist for future features.
- Raw SQL bootstrap exists in `prisma/init.sql` and mirrors the schema.

## API Surface
- Route registration: `src/app.ts`
  - `/api/auth` → `src/routes/auth.ts`
    - POST `/register` create account (nickname, email, password) and set JWT cookie
    - POST `/login` authenticate via nickname or email + password, set JWT cookie
    - POST `/logout` clear auth cookie
    - GET `/me` returns current user (requires auth cookie)
  - `/api/hottakes` → `src/routes/hottakes.ts`
    - GET `/` list all (oldest first)
    - POST `/` create (admin-only via header `x-admin-password` or logged-in admin nickname)
    - PATCH `/:id` update status (admin-only; same rules as above)
  - `/api/submissions` → `src/routes/submissions.ts`
    - GET `/?nickname=…` or `/?userId=…` fetch a submission with score
    - GET `/:nickname` convenience variant
    - POST `/` create or update a user’s picks (5 unique IDs, only from open hottakes)
  - `/api/leaderboard` → `src/routes/leaderboard.ts` (GET) builds sorted ranking via `src/lib/leaderboard.ts`
  - `/api/health` and `/health` → `src/routes/health.ts`
- Static hosting: `express.static(dist/public)`; non-API GETs fall back to `public/index.html` (SPA).

## Domain Rules and Utilities
- Scoring in `src/lib/scoring.ts`:
  - Position weights: `[5,4,3,2,1]` for picks index 0..4.
  - A pick scores only if the referenced hottake status is `WAHR`.
- Leaderboard in `src/lib/leaderboard.ts`:
  - Computes each user’s score from current hottake outcomes, then sorts by score desc, tie-break by earlier `submittedAt`.
- Validation: Use `zod` in routes (see `createHottakeSchema`, `updateStatusSchema`, `submissionSchema`). Parse incoming bodies before DB work.
- Admin auth: `optionalAuth` reads the JWT cookie; `requireAdmin` allows either a logged-in admin nickname (`process.env.ADMIN_NICKNAME` default `lille08`) or the legacy header `x-admin-password` matching `process.env.ADMIN_PASSWORD`.

## Conventions and Patterns
- Keep `src/app.ts` free of network `listen()`; only mount middleware and routes. Start the server only in `src/server.ts`.
- Always import DB via the shared Prisma client in `src/lib/db.ts`.
- Mount `optionalAuth` before admin routes that can rely on the authenticated user (e.g., hottakes); keep `requireAuth` for protected endpoints like `/api/auth/me`.
- Prefer explicit `.json(...)` responses and 4xx/5xx codes; unknown `/api/*` should resolve to `{ message: 'Not Found' }` with 404 (see `app.use('/api', ...)`).
- Central error handler (end of `src/app.ts`) normalizes `ZodError` to 400 with `issues` and other errors to `{ message }`.
- Maintain the `/api` prefix to avoid clashing with SPA fallback routing.

## Local Dev, Build, Run
- Dev server (ts-node-dev): `npm run dev` → starts `src/server.ts` with hot reload.
- Build: `npm run build` → `tsc` to `dist/` then copies `public/` to `dist/public`.
- Start (production): `npm start` → runs `node dist/server.js`. Fallback `server.js` at repo root can serve static `public/` if `dist/` isn’t built.

## Testing (Integration with real Postgres)
- Command: `npm test` (Jest + ts-jest).
- Tests use Testcontainers (`postgres:16-alpine`) and `prisma db push` in `tests/setup.ts`.
  - Requires Docker available to the test runner.
- End-to-end style API tests live in `tests/app.test.ts` and import `src/app` directly.

## Environment Variables
- `DATABASE_URL` (primary). `DIRECT_DATABASE_URL` optional. For local compat, `src/lib/db.ts` maps `DB_URL` → `DATABASE_URL` if needed.
- `JWT_SECRET` **required** for issuing/verifying auth cookies.
- `ADMIN_PASSWORD` optional legacy header for POST/PATCH under `/api/hottakes`.
- `ADMIN_NICKNAME` logged-in admin identifier (defaults to `lille08`; must match the nickname used in the SPA to unlock admin UI).
- `PORT` optional (defaults to `3000`).

## Adding or Modifying Endpoints (Examples)
- New route: create `src/routes/<feature>.ts`, export an Express `Router`, mount under `/api/<feature>` in `src/app.ts`.
- Validate inputs with `zod.parse(req.body)` and handle errors via `next(error)` to leverage the central error middleware.
- Query via Prisma using the minimal needed shape, then transform to small DTOs; see `src/lib/leaderboard.ts` for mapping patterns.
- When reading submissions with scores, reuse `calculateScore(...)` from `src/lib/scoring.ts` to keep business rules consistent.

## Frontend Integration Notes
- Frontend hits the API at `/api` (see `public/src/app.js`, `API_BASE`) and sends credentials via cookies.
- Login/registration lives in `public/login.html` and `public/register.html`; session is managed by the JWT cookie returned by `/api/auth/login|register`.
- Admin UI unlocks when the logged-in nickname matches `ADMIN_NICKNAME` (default `lille08`) and calls the same hottake endpoints; legacy `x-admin-password` header is supported but the SPA primarily uses login.
- Admin expects hottake statuses `OFFEN|WAHR|FALSCH`.

## Phase Status
- Phase 8 (user auth/account flow) is implemented: `/api/auth` supports register/login/logout/me with bcrypt + JWT cookies; SPA includes login/register pages and uses the cookie session to gate play/admin.
- Phase 9 (prefs/dark mode) remains future; `prefs` is unused in the codebase.

---
If anything above is unclear or missing for your task, propose concrete updates to this guide with file paths you’d like clarified.
