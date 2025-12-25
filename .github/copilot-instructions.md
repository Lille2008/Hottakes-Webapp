# Hottakes – AI Coding Agent Guide

This document gives AI coding agents the essential, repo-specific context to be productive immediately. Prefer concrete patterns from this codebase over generic best practices.

## Architecture Overview
- Backend: TypeScript + Express API in `src/`. App wiring lives in `src/app.ts`; process startup is isolated in `src/server.ts`.
- Frontend: Static SPA served from `public/` (vanilla JS in `public/src/app.js`). The API is expected under the `/api` prefix.
- Data: PostgreSQL via Prisma. Client is created once and reused from `src/lib/db.ts` (singleton in dev to avoid multiple connections).
- Domain: “Hottakes” users pick 5 open predictions; scores are computed from actual outcomes and shown in a leaderboard.

## Data Model (Prisma)
- Schema in `prisma/schema.prisma`. Key models:
  - `Hottake { id, text, status: OFFEN|WAHR|FALSCH, createdAt, updatedAt }`
  - `User { id, nickname(unique), email?, passwordHash?, prefs Json? default "{}", submission? }`
  - `Submission { id, userId(unique), picks: Int[], createdAt, updatedAt }`
  - `Setting` and `AdminEvent` exist for future features.
- Raw SQL bootstrap exists in `prisma/init.sql` and mirrors the schema.

## API Surface
- Route registration: `src/app.ts`
  - `/api/hottakes` → `src/routes/hottakes.ts`
    - GET `/` list all (oldest first)
    - POST `/` create (admin-only via header `x-admin-password`)
    - PATCH `/:id` update status (admin-only)
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
- Admin auth: Require header `x-admin-password` to equal `process.env.ADMIN_PASSWORD` for mutating hottake routes.

## Conventions and Patterns
- Keep `src/app.ts` free of network `listen()`; only mount middleware and routes. Start the server only in `src/server.ts`.
- Always import DB via the shared Prisma client in `src/lib/db.ts`.
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
- `ADMIN_PASSWORD` is required for POST/PATCH under `/api/hottakes`.
- `PORT` optional (defaults to `3000`).

## Adding or Modifying Endpoints (Examples)
- New route: create `src/routes/<feature>.ts`, export an Express `Router`, mount under `/api/<feature>` in `src/app.ts`.
- Validate inputs with `zod.parse(req.body)` and handle errors via `next(error)` to leverage the central error middleware.
- Query via Prisma using the minimal needed shape, then transform to small DTOs; see `src/lib/leaderboard.ts` for mapping patterns.
- When reading submissions with scores, reuse `calculateScore(...)` from `src/lib/scoring.ts` to keep business rules consistent.

## Frontend Integration Notes
- Frontend hits the API at `/api` (see `public/src/app.js`, `API_BASE`). Keep API paths stable when changing backend routes.
- Admin UI expects the status values `OFFEN|WAHR|FALSCH` and the `x-admin-password` header to be honored by the API.

## Phase Status
- Phase 8 (user auth/account flow) is **not implemented**: only optional `email`/`passwordHash` fields exist in the schema, there are no auth/login routes beyond the existing hottakes/submissions/leaderboard/health handlers in `src/app.ts`, and the SPA has no auth UI.
- Phase 9 (prefs/dark mode) remains future; `prefs` is unused in the codebase.

---
If anything above is unclear or missing for your task, propose concrete updates to this guide with file paths you’d like clarified.
