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

**User:** Lock-Status soll sofort greifen und Drag&Drop auf Mobile ohne Long-Press funktionieren.

**AI:**
- Lock-State wird vor dem ersten Render/Swipe aktualisiert, damit keine Swipe-Karten mehr erscheinen, wenn der Spieltag gesperrt ist.
- Drag&Drop nutzt HTML5-Drag für Maus und Pointer-Drag für Touch, inklusive visuellem Drop-Feedback.

**User:** Save-Button nur bei 10 Hottakes, read-only Notice rot bei fehlenden Picks, Dropdown-Wrapper entfernen, Option D (Tap-Select + Drag) für Hottakes.

**AI:**
- Save-Button wird nur angezeigt, wenn genau 10 offene Hottakes vorhanden sind.
- Read-only Notice ist rot, wenn keine Picks gespeichert sind; sonst neutral.
- GameDay- und Leaderboard-Selects werden ohne extra Wrapper gerendert.
- Option D umgesetzt: kurzer Tap selektiert, Bewegung startet Drag, Ranks lassen Tap-Tausch zu.

**User:** Slot→Element und Element→Slot sollen beide funktionieren.

**AI:**
- Zusätzlich zum Element‑Select kann nun ein Slot selektiert werden; der nächste Tap platziert oder tauscht.

**User:** Hybrid-UX (Option D) für Click/Drag mit präziser Eingabe-Erkennung, visuelles Feedback und Fail‑Safe‑Swap.

**AI:**
- Click/Drag-Erkennung nutzt jetzt $<10$px & $\le 200$ms für Tap und startet Drag bei $>10$px oder $>200$ms Hold.
- Active-Item bekommt Pulse-Feedback; Slots zeigen im Targeting-Modus breite gestrichelte Konturen mit Glow.
- Swap-Indikator dimmt belegte Slots, Cancel-Button ("Abbrechen") erscheint bei aktiver Auswahl.
- Dragging erhält hohen Z-Index, tiefen Schatten, Pointer-Events-Block und Snap‑Back‑Animation.
- Beim Platzieren wird das alte Item immer in den Pool zurückgeschoben und per Web Animations API animiert.

**User:** Mobile‑First: Drag&Drop soll Touch + Mouse nutzen.

**AI:**
- Drag‑Gesten laufen jetzt über `touchstart/move/end` plus `mousedown/mousemove/up` mit den gleichen Thresholds.
- Pointer‑Capture wurde entfernt; Touch‑Cancel setzt das Item sauber zurück.

**User:** Drag&Drop laggt und List‑Swap fehlt (Rank → Liste tauschen).

**AI:**
- Drag‑Bewegung läuft jetzt über `requestAnimationFrame` mit `translate3d` statt Layout‑Updates.
- Swap in der Liste: Drop auf einen Hottake tauscht jetzt zuverlässig in beide Richtungen.

**User:** Und kann man auch innerhalb der Ranks tauschen?

**AI:**
- Rank↔Rank Swap umgesetzt: Beim Drop auf einen belegten Slot wird das bestehende Item zurück in den Ursprungsslot getauscht (statt in die Liste).

**User:** Implementiere den Schutz vor Datenverlust und die Double-Submit Prevention

**AI:**
- Drafts werden lokal gespeichert (Picks + Swipe-Entscheidungen) und beim Laden im aktiven Modus wiederhergestellt.
- Save-Button ist gegen Mehrfachklicks geschützt und zeigt während des Speicherns „Speichert...“.



