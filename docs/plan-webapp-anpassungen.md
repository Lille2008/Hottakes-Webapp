# Plan: Webapp-Anpassungen (Phase 10)

Stand: 2026-02-01

Ziel: Die Webapp auf Nutzer vorbereiten, erste Klick-Daten sammeln, UX auf Mobile verbessern und nicht benötigte Auth-Flows entfernen.

---

## Prioritäten (kurz)
1. Swipe-Feature (Option 1)
2. FAQ/Q&A + How-to (Installationshilfe)
3. Mobile-UX: Scrollbar ausblenden + Burger-Menü
4. Passwort-Wiederherstellung entfernen

---

## 1) Swipe-Feature (Option 1) – Höchste Priorität Erledigt
**Ziel:** Hottakes zuerst per Swipe bewerten, danach Top-3 ranking. Swipe-Entscheidungen zählen je +1 Punkt, Ranks geben +3/+2/+1 für richtige Vorhersagen.

### 1.1 UX-Flow (geplant)
1. Hottakes einzeln anzeigen (Swipe-Deck, 10 Karten) – Overlay startet automatisch bei jedem Laden.
2. Links = „passiert nicht“, Rechts = „passiert“.
3. Nach 10 Swipes: Entscheidungen werden als Objektliste gespeichert (z. B. `{ hottakeId, decision }`).
4. Rückkehr zur Spieltagsansicht: Top-3 sind vorgefüllt, Rest bleibt darunter.
5. Per Drag&Drop kann neu sortiert werden. Save-Flow bleibt.

### 1.2 Frontend-Arbeitsblöcke
- **HTML:** Swipe-Bereich (Card + Buttons + Progress + Overview + Ranking).
- **CSS:** Swipe-Card, Buttons, Progress, Overview-Liste, Ranking-Slots.
- **JS-Logik:**
  - State: `swipeDeck`, `swipeIndex`, `swipeDecisions` (Objektliste), `swipeCompleted`.
  - Gestures: Touch-Swipe (`touchstart` / `touchend`) + Button-Klicks.
  - Auto-Start: Overlay bei jedem Laden (solange kein Popup offen ist).
  - Mapping zu `picks`: Top‑3 aus „passiert“-Swipes in `picks` schreiben.

### 1.2.1 Data shape (Swipe-Entscheidungen)
- `swipeDecisions`: Liste aus Objekten `{ hottakeId: number, decision: 'hit' | 'pass' }`.
- Optional später: `swipedAt`, falls Timing relevant wird.

### 1.3 Tracking (optional, später)
- Client-Events sammeln (z. B. „swipe_left/right“, „rank_pick“).
- Optional: API-Endpoint `/api/analytics` (nicht jetzt).

---

## 2) FAQ/Q&A + How-to installieren
**Ziel:** Klarer Erklärbereich in Settings (modales Dropdown-Design) + Installationshilfe.

### 2.1 Frontend-Arbeitsblöcke
- **Settings:** Neuer Button „FAQ öffnen“.
- **FAQ-Modal:** Fragen als klickbare Buttons, Antworten als Dropdown-Boxen.
- **How‑to Inhalt:** iOS/Android Anleitung (Home-Bildschirm hinzufügen).
- **JS:** Toggle-Logik für Antworten (`is-open` Klasse).

### 2.2 Backend (optional, später)
- FAQ-Daten aus DB laden (wenn editierbar gewünscht).

---

## 3) Mobile-Optimierung
### 3.1 Scrollbar rechts ausblenden (nur Mobile)
- CSS via Media Query (`@media (max-width: 768px)`).

### 3.2 Burger-Menü
- **Ziel:** Mobile Navigation für Login/Registrieren + Settings/Logout.
- **HTML:** Toggle-Button + Menu-Container.
- **CSS:** Positionierung und responsive Anzeige.
- **JS:** Öffnen/Schließen + Auth-State sync.

---

## 4) Passwort-Wiederherstellung entfernen Erledigt
**Ziel:** Entfernen des E-Mail-Reset-Flows (wenn nicht benötigt).

### 4.1 Frontend
- Entferne „Passwort vergessen?“ Link in Login.
- Optional: forgot/reset Seiten durch Hinweistext ersetzen.

### 4.2 Backend
- Entferne `POST /auth/forgot-password` und `POST /auth/reset-password`.
- Entferne `sendPasswordResetEmail` aus Email-Utility.
- Prisma-Felder (`resetToken`, `resetTokenExpiry`) optional später entfernen (Migration nötig).

---

## 5) Dokumentation (README) Erledigt
- Neue Einträge im KI-Dialog-Logbuch:
  - Welche Features geplant sind.
  - Offene Fragen (z. B. Tracking, FAQ-Content).

---

## Offene Fragen (für später klären)
1. Brauchen wir `swipedAt` als zusätzliches Feld oder reicht `{ hottakeId, decision }`?
2. FAQ-Texte finalisieren – wer liefert den finalen Inhalt?
3. Passwort-Reset wirklich komplett entfernen oder später mit externem Dienst neu einführen?

---

## Nächste Schritte (konkret)
1. Swipe-UI + Logik implementieren (Frontend + Backend + Scoring).
2. FAQ-Modal + How‑to in Settings ergänzen.
3. Mobile CSS (Scrollbar + Burger-Menü).
4. Passwort-Reset entfernen (Frontend + Backend).
5. README-Notiz aktualisieren.
