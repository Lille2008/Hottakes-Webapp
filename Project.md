# 🧠 PROJECT_PLAN.md — Hottakes Development Roadmap

## 🎯 Ziel des Projekts
**Hottakes** ist eine Webapp, in der Nutzer zu Vorhersagen zu einem Spieltag der 1. Fußball Bundesliga abgeben („Hottakes“), Punkte für richtige Einschätzungen erhalten und in einem Leaderboard erscheinen. 
Langfristig soll das Projekt **portfolio-reif** werden: klare Struktur, sauberes Backend, modernes Frontend und solide Architektur.

---

## ✅ Phasen 0–6 (abgeschlossen)

### **Phase 0 – Setup & Projektstart** ✅  
**Ziel:** Grundstruktur der App verstehen und lauffähiges Frontend aufsetzen.  
**Aufgaben:**
- GitHub-Repo angelegt  
- Projektstruktur mit `/frontend` und `/backend` vorbereitet  
- Erste statische HTML/CSS/JS-Dateien  
- Live-Server getestet  

---

### **Phase 1 – Frontend-Basics** ✅  
**Ziel:** Funktionsfähige Startseite mit Dummy-Daten.  
**Aufgaben:**
- HTML-Layout für Hottakes-Übersicht  
- Buttons & Interaktion mit JavaScript  
- Platzhalterdaten für Hottakes angezeigt  

---

### **Phase 2 – State & Interaktion** ✅  
**Ziel:** Klickbare Hot Takes mit Auswahlmöglichkeiten.  
**Aufgaben:**
- JavaScript-Logik: Auswahl speichern  
- Temporäre Speicherung (localStorage)  
- UI-Feedback bei Auswahl  

---

### **Phase 3 – Bewertung & Punkteanzeige** ✅  
**Ziel:** Punkte für richtige Antworten simulieren.  
**Aufgaben:**
- Score-System im Frontend  
- Leaderboard mit Dummy-Daten  
- Punkte-Update nach Auswahl  

---

### **Phase 4 – Admin-Modus & Einreichungssystem (Frontend)** ✅  
**Ziel:** Neue Hot Takes anlegen und verwalten.  
**Aufgaben:**
- Admin-UI (passwortgeschützt im Frontend)  
- Form zur Erstellung von Hot Takes  
- Lokales Speichern der erstellten Takes  

---

### **Phase 5 – Vorbereitung auf Backend** ✅  
**Ziel:** Trennung zwischen Frontend und Backend vorbereiten.  
**Aufgaben:**
- API-Aufrufe simuliert  
- Struktur `/api/...` eingeführt  
- Alle Hot Takes und Submissions in separaten JSON-Dateien  

---

### **Phase 6 – Scoring-System (Simulation)** ✅  
**Ziel:** Punktevergabe und Leaderboard final testen.  
**Aufgaben:**
- Berechnungslogik für Scores fertig  
- Leaderboard wird dynamisch sortiert  
- Alle Mechaniken funktionieren lokal  

---

## 🚀 Phase 7 – Basis-Backend & API ✅

**Ziel:** Zentrale API, DB-Anbindung und persistente Speicherung für Hottakes, Submissions und Leaderboard.

**Aufgaben:**
1. Wähle DB-Backend (z. B. PostgreSQL bei Render) und lege Service an.  
2. Erstelle DB-Schema (Tabellen):  
   - `hottakes`  
   - `submissions`  
   - `users`  
   - `settings`  
   - `admin_events` (inkl. Spalte für Sperrzeiten)
3. Implementiere Node/Express-API-Endpunkte:  
   - `GET /api/hottakes`  
   - `POST /api/hottakes` (admin)  
   - `GET /api/submissions/:nickname` oder `GET /api/submissions?userId=...`  
   - `POST /api/submissions` (speichert Picks)  
   - `GET /api/leaderboard`  
   - `GET /health` (health check)
4. DB-Zugriffsschicht einbauen (z. B. pg, knex, Sequelize oder Prisma).  
5. Environment-Variables konfigurieren (`DB_URL`, `ADMIN_PASSWORD`, `NODE_ENV`).  
6. Lokale Tests: Endpunkte mit curl/Postman testen; einfache Unit-Tests für Scoring-Funktion.

**Abschlusskriterien:**  
- API antwortet korrekt (JSON) für alle Endpunkte.  
- Picks werden in DB gespeichert und vom Leaderboard korrekt aggregiert.  
- `/health` liefert 200 zurück.

---

## 🔐 Phase 8 – Accounts & Auth ✅

**Ziel:** Echte Benutzerkonten, Login-Flows, sichere Speicherung.

**Aufgaben:**
1. Entscheide: klassisches Passwortsystem oder passwortlos (Magic Links / One-time code).  
2. `users`-Tabelle: `id`, `username`, `email`, `password_hash`, `created_at`, `prefs_json`.  
3. Implementiere Auth-Endpunkte:  
   - `POST /api/auth/register`  
   - `POST /api/auth/login` → JWT oder Session-Cookies  
   - Optional: `POST /api/auth/magic` für Magic-Link-Flow  
4. Passwortsicherheit mit bcrypt oder argon2.  
5. Auth-Middleware für geschützte Routen.  
6. Optional: „Remember me“ / Token Refresh.

**Abschlusskriterien:**  
- Nutzer können sich registrieren und einloggen.  
- Auth-geschützte Routen funktionieren.  
- Passwortdaten sind gehasht gespeichert.

---

## ⚙️ Phase 9 – Nutzerpräferenzen & UI (Theme & Settings) ✅

**Ziel:** Geräteübergreifende Theme-Einstellungen pro Nutzer + moderneres UI.

**Umsetzung:**
- Theme-Auswahl (Dark/Light/Auto) wird in `users.prefs.themeMode` gespeichert.  
- API: `PATCH /api/auth/prefs` speichert Theme-Mode für eingeloggte User.  
- Frontend: Settings-Drawer mit Theme-Pills, Auto reagiert auf `prefers-color-scheme`.  
- Header: Settings-Icon nur eingeloggt; Gäste sehen Anmelden/Registrieren.  
- UI-Refresh (Grid/Flex, modernisiertes Styling, modale Legal-Overlays).

**Abschlusskriterien:**  
- Theme wird pro User gespeichert, geladen und bei Auto mit Geräteeinstellung synchronisiert.  
- UI wirkt moderner; Einstellungen sind klar zugänglich.

---

## 🧩 Phase 10 – Game Day Features: Lock System, Email & Hot Takes Lifecycle

**Ziel:** Implementierung eines vollständigen Game-Day-Managements mit drei Kernfunktionen.

**Detaillierte Implementierungsplanung:** Siehe `implementation-plan-phase-10.md`

### **Kernanforderungen (3 Features erforderlich):**

#### 1️⃣ **Zeit-basierte Spieltags-Sperre**
**Problem:** Nutzer müssen daran gehindert werden, Picks nach Spielstart zu ändern.

**Aufgaben:**
- Tabelle `admin_events` nutzen mit: `id`, `start_time`, `lock_time`, `end_time`, `description`, `active_flag` (bereits vorhanden)
- Admin-CRUD-Endpunkte für Game Days: `POST/GET/PATCH/DELETE /api/admin/game-days`
- Middleware `checkGameDayLock`: vor `POST /api/submissions` prüfen, ob `now < lock_time`
- Frontend: Countdown-Timer bis Lock-Zeit, Fehlermeldung bei gesperrter Abgabe

**Abschlusskriterien:**
- ✅ Admin kann Sperrzeiten für Game Days setzen
- ✅ Submissions nach `lock_time` werden mit HTTP 403 abgelehnt
- ✅ Admin-Endpunkte sind durch `requireAdmin` geschützt
- ✅ Frontend zeigt Lock-Status deutlich an

#### 2️⃣ **E-Mail-System (Passwort-Reset & Erinnerungen)**
**Problem:** Nutzer brauchen Passwort-Wiederherstellung und Erinnerungen vor Deadline.

**Aufgaben:**
- **Dependencies:** `nodemailer`, `node-cron`, `resend` (oder alternative wie Brevo)
- **Passwort-Reset-Flow:**
  - User-Modell erweitern: `resetToken`, `resetTokenExpiry` (Prisma-Migration)
  - Endpunkte: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
  - Sichere Token-Generierung mit `crypto.randomBytes(32)`, Ablauf nach 1 Stunde
  - E-Mail mit Reset-Link senden via Resend/Brevo
  - Frontend-Seiten: `public/forgot-password.html`, `public/reset-password.html`
- **Game-Day-Erinnerungen:**
  - Cron-Job (täglich 8:00 Uhr): findet Game Days in nächsten 24h
  - Ermittelt User ohne Submission, sendet Erinnerungs-E-Mail
  - Scheduler in `src/lib/scheduler.ts`, Start in `src/server.ts`

**Abschlusskriterien:**
- ✅ Nutzer können per E-Mail Passwort zurücksetzen (Token-basiert, sicher)
- ✅ Automatische Erinnerungs-E-Mails vor Game-Day-Lock
- ✅ E-Mail-Service konfiguriert (Resend/Brevo Free Tier)
- ✅ `.env` enthält: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`

#### 3️⃣ **Hot-Takes-Lifecycle-Management**
**Problem:** Nach Game Day müssen alte Takes archiviert, aber sichtbar bleiben; neue Takes für nächsten Spieltag bereitstellen.

**Aufgaben:**
- **Strategie:** Status-basierte Filterung (OFFEN = aktiv, WAHR/FALSCH = archiviert)
- Optional: Hottake-Relation zu `game_day_id` hinzufügen (empfohlen für bessere Organisation)
- `GET /api/hottakes?archived=false` (Standard): zeigt nur offene Takes
- `GET /api/hottakes?archived=true`: zeigt abgeschlossene Takes (History)
- Admin-Endpunkt: `POST /api/admin/game-days/:id/finalize` (setzt `activeFlag=false`)
- Frontend: Zwei Tabs/Views:
  - **"Aktive Picks"** → offene Takes, Submission-Form
  - **"Historie"** → abgeschlossene Takes, Leaderboard-Snapshot

**Abschlusskriterien:**
- ✅ Alte Hot Takes bleiben zur Punkteanzeige erhalten (nicht gelöscht)
- ✅ Frontend zeigt nur aktive/offene Takes standardmäßig an
- ✅ History-View zeigt vergangene Takes mit Ergebnissen
- ✅ Admin kann Game Day finalisieren (Status-Wechsel aller Takes)

---

## 🎨 Phase 11 – Feature Polish: UI/UX, Icon & Branding

**Ziel:** App wirkt ausgereift und portfolio-tauglich.

**Aufgaben:**
1. Icon-Design und Farbpalette definieren.  
2. UI-Feinschliff: Animationen, responsive Leaderboard.  
3. Accessibility-Prüfung (Kontraste, ARIA Labels).  
4. PWA-Meta & Manifest optional.  
5. Dokumentation: README mit Screenshots & Architekturdiagramm.

**Abschlusskriterien:**  
- Einheitliches Design, mobilfreundlich.  
- README vollständig.

---

## 🧪 Phase 12 – Tests, Deployment, Monitoring & Backup

**Ziel:** Stabiler Betrieb & automatische Deploys.

**Aufgaben:**
1. Unit- & Integrationstests (Jest/Supertest).  
2. CI mit GitHub Actions.  
3. DB-Backups konfigurieren.  
4. Error Logging & Monitoring (z. B. Sentry).  
5. Rollback-Plan & Health-Monitor.

**Abschlusskriterien:**  
- Tests laufen automatisch bei jedem Push.  
- Backups funktionsfähig.  
- Monitoring aktiv.

---

## 🌍 Phase 13 – Extras & Skalierung (optional)

**Ziel:** Erweiterung & Performance.

**Aufgaben:**
1. Echtzeit-Updates (Socket.io).  
2. Rate-Limiting & Captcha.  
3. Caching (Redis).  
4. Multi-Region-Deploys / CDN.

**Abschlusskriterien:**  
- Live-Updates aktiv.  
- Skalierung möglich.
