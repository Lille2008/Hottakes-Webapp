# Hottakes – Leitfaden für KI-Coding-Agenten

Dieses Dokument gibt dir alle repo-spezifischen Hinweise, die du brauchst, um hier sinnvoll zu arbeiten. Die Zielgruppe ist ein Coding-Einsteiger. Erkläre deshalb jeden Schritt kurz und verständlich. Motiviere aktiv dazu, selbst Code zu schreiben und den Code zu verstehen.

## Wichtige Arbeitsprinzipien (bitte immer beachten)
- **Alles auf der Webapp auf Deutsch:** Die gesamte UI ist auf Deutsch. Die Kommentare und Erklärungen sollen auf Englisch sein; der Nutzer ist aber deutschsprachig und möchte die Konzepte verstehen, aber gleichzeitig auch die englischen Begriffe im Code lernen, um sein Englisch zu verbessern.
- **Jeden Schritt erklären:** Schreibe kurze Erklärungen, warum du etwas tust und was es bewirkt.
- **Einsteigerfreundlich motivieren:** Ermutige den Nutzer, selbst Code zu schreiben oder gezielt nachzuvollziehen. Beispiel: „Probier gerne selbst, die Variable umzubenennen – ich erkläre dir, was dabei passiert.“
- **Kommentare nutzen:** Wenn du Code änderst oder neu schreibst, füge hilfreiche Kommentare hinzu, die *warum* und *wie* erklären (nicht nur *was*).
- **README als KI-Konversation nutzen:** Halte neue Erkenntnisse, offene Fragen und Probleme in der README in Form einer KI-Dialog-Notiz fest.
- **Konkrete Hinweise geben:** Bei Änderungen nenne die betroffenen Dateien/Ordner und erkläre kurz die Auswirkungen.
- **Keine Annahmen:** Wenn etwas unklar ist, recherchiere kurz im Code oder frag gezielt nach.

## Architektur-Überblick
- Backend: TypeScript + Express API in `src/`. Die App-Wiring-Logik ist in `src/app.ts`, der Serverstart in `src/server.ts`.
- Frontend: Statische SPA aus `public/` (Vanilla JS in `public/src/app.js`). Die API liegt unter `/api` und nutzt JWT-Cookies.
- Daten: PostgreSQL via Prisma. Client kommt aus `src/lib/db.ts` (Singleton in Dev, um Mehrfach-Verbindungen zu vermeiden).
- Domain: „Hottakes“ – Nutzer wählen 5 offene Vorhersagen; Score wird aus tatsächlichen Outcomes berechnet und im Leaderboard angezeigt.

## Datenmodell (Prisma)
- Schema liegt in `prisma/schema.prisma`. Wichtigste Modelle:
  - `Hottake { id, text, status: OFFEN|WAHR|FALSCH, createdAt, updatedAt }`
  - `User { id, nickname(unique), email, passwordHash, prefs Json? default "{}", submission? }`
  - `Submission { id, userId, gameDay, picks: Int[], createdAt, updatedAt }` (Unique: `@@unique([userId, gameDay])`)
  - `Setting` und `AdminEvent` sind für später vorgesehen.
- Rohes SQL-Bootstrap in `prisma/init.sql` (spiegelt das Schema).

## Deployment (Render + Supabase)
- Hosting: Die App wird auf **Render** deployed.
- Datenbank: PostgreSQL läuft auf **Supabase**.
- Wichtig für Bugs/Support: Wenn Prisma-Fehler wie "Unique constraint failed on (`userId`)" auftreten, liegt das häufig an einer *alten* DB-Constraint/Index-Struktur auf Supabase (siehe Abschnitt unten).

**Praktische Hinweise (für Einsteiger):**
- Render braucht die Env Vars wie lokal: `DATABASE_URL`, `JWT_SECRET`, optional `ADMIN_NICKNAME`, `ADMIN_PASSWORD`.
- Supabase hat oft mehrere Connection Strings (Pooler vs Direct).
  - Für normale App-Queries reicht meistens der Pooler.
  - Für Schema-Fixes/Migrations ist der **Direct connection** String oft die sicherste Wahl.

## Bekannter DB-Fix: Legacy Unique-Constraint auf Submissions
- Symptom: `Invalid prisma.submission.upsert()` + `Unique constraint failed on the fields: (userId)`.
- Ursache: In der DB existiert noch eine alte `UNIQUE(userId)`-Constraint/Index, obwohl das Prisma-Schema korrekt `@@unique([userId, gameDay])` erwartet.
- Fix:
  - Script: `npm run fix:submission-constraint` (nutzt die Env `DATABASE_URL`)
  - Doku: `docs/fix-submission-constraint.md`

## API-Oberfläche
- Routen-Registrierung: `src/app.ts`
  - `/api/auth` → `src/routes/auth.ts`
    - POST `/register` erstellt Account (Nickname, Email, Passwort) und setzt JWT-Cookie
    - POST `/login` authentifiziert per Nickname oder Email + Passwort, setzt JWT-Cookie
    - POST `/logout` löscht Auth-Cookie
    - GET `/me` gibt aktuellen Nutzer zurück (Auth-Cookie nötig)
  - `/api/hottakes` → `src/routes/hottakes.ts`
    - GET `/` listet alle (älteste zuerst)
    - POST `/` erstellt (nur Admin, Header `x-admin-password` oder Admin-Nickname)
    - PATCH `/:id` Status aktualisieren (nur Admin, gleiche Regeln)
  - `/api/submissions` → `src/routes/submissions.ts`
    - GET `/?nickname=…` oder `/?userId=…` holt Submission inkl. Score
    - GET `/:nickname` Kurz-Variante
    - POST `/` erstellt/updated Picks (5 eindeutige IDs, nur offene Hottakes)
  - `/api/leaderboard` → `src/routes/leaderboard.ts` (GET) berechnet Ranking via `src/lib/leaderboard.ts`
  - `/api/health` und `/health` → `src/routes/health.ts`
- Static Hosting: `express.static(dist/public)`; alle nicht-API-GETs gehen auf `public/index.html` (SPA).

## Domain-Regeln und Utilities
- Scoring in `src/lib/scoring.ts`:
  - Positions-Gewichte: `[5,4,3,2,1]` für Picks 0..4.
  - Ein Pick zählt nur, wenn der Status `WAHR` ist.
- Leaderboard in `src/lib/leaderboard.ts`:
  - Berechnet Score und sortiert absteigend; Tie-Breaker: frühere `submittedAt`.
- Validierung: Nutze `zod` in Routes (z. B. `createHottakeSchema`, `updateStatusSchema`, `submissionSchema`). Body vor DB-Operation parsen.
- Admin-Auth: `optionalAuth` liest JWT-Cookie; `requireAdmin` erlaubt Admin-Nickname (`process.env.ADMIN_NICKNAME`, default `lille08`) oder den Legacy-Header `x-admin-password` (`process.env.ADMIN_PASSWORD`).

## Konventionen und Muster
- `src/app.ts` enthält **kein** `listen()`; nur Middleware + Routen. Serverstart nur in `src/server.ts`.
- DB immer über den geteilten Prisma-Client aus `src/lib/db.ts`.
- `optionalAuth` vor Admin-Routen (z. B. Hottakes), `requireAuth` nur für geschützte Endpoints (z. B. `/api/auth/me`).
- Klare `.json(...)`-Antworten und 4xx/5xx-Statuscodes. Unbekannte `/api/*` → `{ message: 'Not Found' }` mit 404.
- Zentraler Error-Handler (Ende `src/app.ts`) normalisiert `ZodError` zu 400 mit `issues`, sonst `{ message }`.
- `/api`-Prefix beibehalten (SPA-Fallback braucht das).

## Lokal entwickeln, bauen, starten
- Dev-Server (ts-node-dev): `npm run dev` → startet `src/server.ts` mit Hot-Reload.
- Build: `npm run build` → `tsc` nach `dist/`, dann `public/` nach `dist/public`.
- Start (Prod): `npm start` → `node dist/server.js`. Fallback: `server.js` im Root kann `public/` ohne Build ausliefern.

## Tests (Integration mit echtem Postgres)
- Befehl: `npm test` (Jest + ts-jest).
- Tests nutzen Testcontainers (`postgres:16-alpine`) und `prisma db push` in `tests/setup.ts`.
  - Docker muss verfügbar sein.
- End-to-end API-Tests in `tests/app.test.ts`, importieren `src/app` direkt.

## Umgebungsvariablen
- `DATABASE_URL` (primär). `DIRECT_DATABASE_URL` optional. `src/lib/db.ts` mappt `DB_URL` → `DATABASE_URL`.
- `JWT_SECRET` **Pflicht** für Auth-Cookies.
- `ADMIN_PASSWORD` optionaler Legacy-Header für POST/PATCH unter `/api/hottakes`.
- `ADMIN_NICKNAME` Admin-Identifikator (default `lille08`; muss zur SPA passen).
- `PORT` optional (default `3000`).

## Endpoints hinzufügen oder ändern (Beispiele)
- Neue Route: `src/routes/<feature>.ts` anlegen, Express-`Router` exportieren, in `src/app.ts` unter `/api/<feature>` mounten.
- Inputs mit `zod.parse(req.body)` validieren und Fehler via `next(error)` an den zentralen Handler geben.
- Prisma-Abfragen nur mit benötigtem Shape; Ergebnisse in kleine DTOs umwandeln (Beispiel: `src/lib/leaderboard.ts`).
- Bei Submissions mit Score `calculateScore(...)` aus `src/lib/scoring.ts` verwenden.

## Frontend-Integration
- Frontend ruft die API unter `/api` auf (siehe `public/src/app.js`, `API_BASE`) und sendet Credentials via Cookies.
- Login/Registrierung: `public/login.html` und `public/register.html`; Session wird per JWT-Cookie verwaltet.
- Admin-UI wird aktiviert, wenn der Nickname `ADMIN_NICKNAME` entspricht; nutzt die gleichen Hottake-Endpoints.
- Admin erwartet Hottake-Statuswerte `OFFEN|WAHR|FALSCH`.

## Phasen-Status
- Phase 8 (Auth/Accounts) ist umgesetzt: `/api/auth` kann register/login/logout/me, nutzt bcrypt + JWT-Cookies; SPA enthält Login/Register und Cookie-Session.
- Phase 9 (Prefs/Dark Mode) ist offen; `prefs` wird noch nicht genutzt.

---
Wenn etwas unklar ist, schlage konkrete Ergänzungen für diesen Leitfaden vor (mit Dateipfaden). Denke immer daran: **kurz erklären, motivieren, und Kommentare nutzen**.
