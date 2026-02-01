## KI-Dialog-Logbuch (Erkenntnisse & Probleme)

> Format: Dies ist der Ort für die Dokumentation unserer Erkenntnisse, offenen Fragen und Probleme.
> Bitte füge neue Einträge immer mit Datum hinzu. Sprache: **Deutsch**.

### 2026-01-31

**User:** Können User ihre Picks speichern, wenn ein Spieltag `PENDING` oder `ACTIVE` ist?

**AI:**
- Ja: Speichern ist erlaubt für `PENDING` und `ACTIVE`, solange die `lockTime` noch nicht erreicht ist. Umsetzung: [src/routes/submissions.ts](src/routes/submissions.ts)
- Das Locking blockt abgeschlossene/archivierte Spieltage jetzt auch dann, wenn `lockTime = null` ist (Status-Check vor dem Early-Return). Umsetzung: [src/middleware/checkGameDayLock.ts](src/middleware/checkGameDayLock.ts)

**User:** Geht `PENDING` automatisch auf `ACTIVE`, wenn `lockTime` weniger als 5 Tage entfernt ist?

**AI:**
- Ja, jetzt automatisiert: Ein täglicher Cronjob um `05:00` setzt `PENDING` → `ACTIVE`, wenn `lockTime` innerhalb der nächsten 5 Tage liegt (oder bereits in der Vergangenheit). Umsetzung: [src/lib/scheduler.ts](src/lib/scheduler.ts)

### 2026-02-01

**User:** Swipe-Flow ersetzt Drag&Drop (5 Ranks) und neue Scoring-Logik

**AI:**
- Swipe-Overlay startet bei jedem Laden für aktive, nicht gesperrte Spieltage mit exakt 10 offenen Hottakes.
- Swipe-Entscheidungen werden gespeichert (Objektliste `{ hottakeId, decision }`) und geben je +1 Punkt bei richtiger Vorhersage.
- Top-3 Ranks geben zusätzliche Punkte $3,2,1$ bei `WAHR`.
- Alte Submissions wurden vorab gelöscht.

**User:** Lock soll read-only sein, Ranks leer mit kurzer Erklärung, Save-Button im read-only/Admin ausblenden, Swipe-Flow ohne Auto-Rank, Drag sofort starten.

**AI:**
- Read-only wird bei Lock erzwungen; Swipe-Overlay wird geschlossen und Save-Button im read-only/Admin ausgeblendet.
- Nach dem Swipen bleiben die Ranks leer; alle 10 Hottakes bleiben unter den Ranks.
- Drag&Drop nutzt Pointer-Events für sofortiges Dragging (ohne Long-Press).



