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

## 🧩 Phase 10 – Admin-Funktionen & Spieltags-Sperrlogik

**Ziel:** Admin kann Spielzeiten verwalten und Einsendungen sperren.

**Aufgaben:**
1. Tabelle `admin_events` oder `game_rounds` mit:  
   `id`, `start_time`, `lock_time`, `end_time`, `description`, `active_flag`.
2. Admin-UI mit CRUD-Endpunkten (`POST/PUT/DELETE /api/admin/events`).  
3. Validierung: vor `POST /api/submissions` prüfen, ob `now < lock_time`.  
4. Optional: Scheduler oder Cronjob zur Sperrzeit-Steuerung.  

**Abschlusskriterien:**  
- Admin kann Sperrzeiten setzen.  
- Submissions nach Sperrzeit werden abgelehnt.  
- Admin-Endpunkte sind geschützt.

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
