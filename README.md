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

**User:** Swipe-Message entfernen & Click-Swaps verbessern

**AI:**
- Die grüne „Swipes gespeichert“-Meldung nach dem Swipe-Flow wurde entfernt.
- Klick-Swaps innerhalb der Ranks funktionieren nun zuverlässig; Slot-Selection geht über das Rank-Label.
- Beim Ziehen innerhalb der Liste wird der Hottakes-Container nicht mehr gestrichelt umrandet.

**User:** App hängt beim Rank→Liste‑Swap

**AI:**
- Swap-Logik angepasst: Das gezogene Item wird zuerst in die Liste eingesetzt, bevor das Ziel-Item in den Rank wandert.

**User:** Rank bleibt immer gefüllt + List‑Swap per Click

**AI:**
- Ein gefüllter Rank kann nicht mehr per Click/Drag in die leere Liste entleert werden; nur Swaps sind erlaubt.
- Click‑Swap unterstützt jetzt Rank↔Liste und Liste↔Liste (Drag&Drop bleibt erhalten).

**User:** Gestrichelte Umrandung bleibt manchmal hängen

**AI:**
- Drop-Target-Styles werden beim Verlassen der Auswahl immer entfernt.

**User:** Picks-Button verschieben & Rank-Hinweis entfernen

**AI:**
- „Picks Speichern“ liegt jetzt unter dem Spieltag-Banner und nicht mehr im Rank-Header.
- Hinweis „Du kannst auch \"passiert nicht\" ranken.“ wurde entfernt.

**User:** Click-Modus springt nach Slot-Placement zurück

**AI:**
- Pending-Gesture wird beim Tap gelöscht, damit keine „Geister-Auswahl“ entsteht.

### 2026-02-02

**User:** Save-Button entfernen und Auto-Save einführen (erste Speicherung bei vollständig gefüllten Ranks, danach debounce pro Änderung).

**AI:**
- Save-Button aus der UI entfernt und Initialisierung so angepasst, dass er optional ist. Umsetzung: [public/index.html](public/index.html) und [public/src/app.js](public/src/app.js)
- Auto-Save mit Debounce eingeführt: erste Speicherung sofort, sobald alle drei Ranks erstmals belegt sind; danach wird bei jeder Änderung ein Debounce-Timer gestartet und still gespeichert. Umsetzung: [public/src/app.js](public/src/app.js)
- Auto-Save resettiert beim Wechsel des Spieltags, damit pro Spieltag neu gestartet wird. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Auto-Save soll oben kurz "Gespeichert" anzeigen.

**AI:**
- Kurzes Toast oben eingebaut (1 Sekunde) bei jedem Auto-Save. Umsetzung: [public/src/app.js](public/src/app.js) und [public/src/styles.css](public/src/styles.css)

**User:** Nutzer mit vorhandenen Submissions sollen nicht erneut swipen müssen.

**AI:**
- Swipe-Overlay wird übersprungen, wenn für den Spieltag bereits eine Submission mit Swipe-Entscheidungen existiert; Swipe-State wird beim Laden und beim Spieltagwechsel korrekt gesetzt. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Click-Interaktionen entfernen, nur Drag&Drop

**AI:**
- Alle Click-Selections/Swaps entfernt; Interaktion läuft jetzt ausschließlich über Drag&Drop.

**User:** Click-Styles aus CSS/HTML entfernen

**AI:**
- Styles für Click-UI (Swap-Hinweis, Auswahl-Pulse, Abbrechen-Button) entfernt.

### 2026-02-02

**User:** Drag&Drop: Rank↔Liste tauschen springt manchmal ans Listenende; Drop-Umrandung bleibt stehen.

**AI:**
- Beim Drag von der Liste in einen belegten Rank wird das verdrängte Item nun an der ursprünglichen Listenposition eingefügt (statt ans Listenende) und nutzt Platzhalter/Next-Sibling als Anker. Umsetzung: [public/src/app.js](public/src/app.js)
- Drop-Target-Umrandungen werden global entfernt, auch wenn ein markiertes Item in einen Rank wandert. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Ich möchte nirgendwo eine Scrollbar zu sehen haben.

**AI:**
- Scrollbars werden global ausgeblendet (ohne Scrollen zu deaktivieren). Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Swipe-Mode per Klick, Skip-Logik, Lock-Infos im Spieltagscontainer und Readonly-Transparenz.

**AI:**
- Swipe-Overlay öffnet per Klick auf eine Hottake-Karte (Auto-Start nur bei 10 offenen) und bietet jetzt Schließen (Kreuz) sowie Überspringen. Umsetzung: [public/src/app.js](public/src/app.js) und [public/index.html](public/index.html)
- Skipped/Swiped-Feedback wird per grün/rot Glow bzw. grauer Skip-Karte in Ranks + Liste angezeigt. Umsetzung: [public/src/app.js](public/src/app.js) und [public/src/styles.css](public/src/styles.css)
- Lock-Hinweise und Offene-Hottakes-Counter wurden unter das Dropdown verschoben; alte Banner-Texte entfernt; Counter blendet bei Lock aus. Umsetzung: [public/src/app.js](public/src/app.js), [public/index.html](public/index.html), [public/src/styles.css](public/src/styles.css)
- Readonly-Mode zeigt alle Hottakes mit Opacity 0.7 und blockiert Swipe nach LockTime. Umsetzung: [public/src/app.js](public/src/app.js) und [public/src/styles.css](public/src/styles.css)
- Backend erlaubt Skip-Entscheidungen und ignoriert sie beim Scoring. Umsetzung: [src/routes/submissions.ts](src/routes/submissions.ts), [src/lib/scoring.ts](src/lib/scoring.ts), [src/lib/leaderboard.ts](src/lib/leaderboard.ts)

### 2026-02-03

**User:** Übersprungene Karten sehen falsch aus, Counter zählt sie nicht, und im Swipe-Deck erscheinen zu viele Karten.

**AI:**
- Skip-Karten sehen wieder wie offene Hottakes aus (Text bleibt sichtbar, keine graue Skip-Optik). Umsetzung: [public/src/app.js](public/src/app.js)
- Swipe-Deck zeigt beim Klick: gewählte Karte zuerst, danach nur offene (nicht final entschiedene) Karten. Umsetzung: [public/src/app.js](public/src/app.js)
- Offene-Hottakes-Counter zählt Skips wieder mit, weil Skip als „offen“ behandelt wird. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Finalisierte/gesperrte Spieltage sollen Hottakes zeigen, Ergebnis-Badge mit Symbolen, und “(aktiv)” nach 5‑Tage‑Regel nur für den nächsten Spieltag.

**AI:**
- Read-only Hottakes zeigen jetzt auch bei FINALIZED/ARCHIVED alle Hottakes (nicht leer), inklusive Ergebnis-Badge mit ?/✓/✗ für OFFEN/WAHR/FALSCH. Umsetzung: [public/src/app.js](public/src/app.js) und [public/src/styles.css](public/src/styles.css)
- “(aktiv)” in allen Spieltag-Selects folgt der UI-Regel: locked aber nicht finalized **oder** nächste LockTime innerhalb von 5 Tagen. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Ergebnis-Badge soll nur so groß wie der Text sein und Spieltag/Leaderboard-Dropdowns nach LockTime sortieren (früheste zuerst).

**AI:**
- Ergebnis-Badge schrumpft jetzt auf Inhalt und bleibt rechts unten im Hottake. Umsetzung: [public/src/styles.css](public/src/styles.css)
- Spieltag- und Leaderboard-Dropdowns sortieren nach frühester LockTime. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Ergebnis-Badge soll den Hottake-Text nicht umbrechen (Text bleibt neben dem Drag-Handle).

**AI:**
- Ergebnis-Badge nutzt jetzt eine eigene Pill innerhalb einer Zeile, damit Handle + Text zusammenbleiben. Umsetzung: [public/src/app.js](public/src/app.js) und [public/src/styles.css](public/src/styles.css)

**User:** Hottake-Body soll immer einheitlich sein, unabhängig von Ergebnis oder User-Entscheidung.

**AI:**
- Status-spezifische Hintergrundfarben entfernt, nur der Rand zeigt Status/Entscheidung. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Swipe-Entscheidungen nach späteren Swipes sollen sicher gespeichert werden.

**AI:**
- Swipe-Entscheidungen lösen jetzt Auto-Save aus, damit nachträgliche Entscheidungen nicht als „offen“ hängen bleiben. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Entscheidung per Swipe soll als Rahmen bleiben, aber bei Lock trotzdem gleich blass aussehen.

**AI:**
- Readonly-Swipe-Hottakes behalten den Rahmen, aber die Glow-Schatten werden entfernt, damit alle Bodies gleich blass wirken. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Später entschiedene Hottakes sollen im finalized gleich blass aussehen wie alle anderen.

**AI:**
- Swipe-Decision-Styles werden bei Ergebnis-Badges nicht gesetzt, damit die Opacity für alle gleich bleibt. Umsetzung: [public/src/app.js](public/src/app.js)



