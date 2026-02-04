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


### 2026-02-04

**User:** Die beiden Elemente sollen gleich groß sein.

**AI:**
- Im Profil sind User-Chip und Logout-Button jetzt gleich hoch, damit sie optisch zusammenpassen. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Der User-Chip soll die gleiche Eckenrundung haben wie der Logout-Button. Das aktuelle blau der schrift vom User-Chip soll der Hintergrund werden und die Schrift wird weiß.

**AI:**
- Der User-Chip nutzt jetzt die gleiche Rundung wie der Logout-Button und hat eine blaue Fläche mit weißer Schrift. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Container nach LockTime sind schmaler als das Banner.

**AI:**
- Game-Container sind jetzt immer auf volle Breite gestreckt, damit Ranks/Hottakes so breit wie der obere Container sind. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Leaderboard-Überarbeitung, automatische Spieltag-Auswahl nach zuletzt erreichter LockTime (Vergangenheit), Admin-List-Bug, und neue Seiten-Container für Profil/Spieltag/Leaderboard.

**AI:**
- Leaderboard zeigt jetzt Spieltag- und Gesamtpunkte nebeneinander; Auswahl läuft über den Banner-Select und nutzt die letzte erreichte LockTime. Umsetzung: [public/src/app.js](public/src/app.js) und [public/src/styles.css](public/src/styles.css)
- Admin-Liste lädt Hottakes wieder korrekt, auch im Admin-Bereich. Umsetzung: [public/src/app.js](public/src/app.js)
- Profil/Spieltag/Leaderboard sind in neue Seiten-Container mit Admin-Breite eingebettet. Umsetzung: [public/profil.html](public/profil.html), [public/spieltag.html](public/spieltag.html), [public/leaderboard.html](public/leaderboard.html), [public/src/styles.css](public/src/styles.css)

**User:** Die Container auf der Spieltags-Seite wirken kleiner.

**AI:**
- Die GameDay- und Game-Container füllen jetzt die volle Seitenbreite innerhalb der neuen Page-Shell. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Ranks- und Hottakes-Container sind noch dünn.

**AI:**
- Ranks- und Hottakes-Container füllen jetzt die volle Breite innerhalb der Page-Shell. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Nach der LockTime sind die Container weiterhin zu schmal.

**AI:**
- Die Game-Layout-Ausrichtung streckt jetzt auch im Locked/Readonly-Zustand auf volle Breite. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Swipe-Overlay: Karten lassen sich nicht ziehen, Buttons fehlen, Back-Card sichtbar.

**AI:**
- Swipe-Overlay-Layout korrigiert (Back-Card positioniert, Actions sichtbar) und Fokus vor aria-hidden entfernt. Umsetzung: [public/src/styles.css](public/src/styles.css), [public/src/app.js](public/src/app.js)

**User:** Ranks- und Hottakes-Container passen sich an die Textlänge an.

**AI:**
- Hottake-Listen, Rank-Slots und Karten sind jetzt auf feste Breite (100%) gesetzt, damit sie nicht mit Textlänge schrumpfen. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Ranks- und Hottakes-Container sind manchmal noch nicht breit genug.

**AI:**
- Container werden per Flex-Basis fix auf volle Breite gehalten, damit sie nicht schrumpfen. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Ranks- und Hottakes-Container sollen exakt so breit wie das Game-Day-Banner sein.

**AI:**
- Banner und Game-Container werden jetzt auf identische volle Breite innerhalb der Page-Shell gezwungen. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Ranks- und Hottakes-Container sind weiter schmaler als das Game-Day-Banner.

**AI:**
- Spieltag-Seite erzwingt jetzt identische Breite für Banner, Ranks und Hottakes per page-spezifischem CSS. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Profil-, Spieltag- und Leaderboard-Seite sollen einen Admin-ähnlichen Container um alle Elemente haben.

**AI:**
- Alle drei Seiten sind jetzt in eine Page-Panel-Box mit Admin-Style gewrappt. Umsetzung: [public/profil.html](public/profil.html), [public/spieltag.html](public/spieltag.html), [public/leaderboard.html](public/leaderboard.html), [public/src/styles.css](public/src/styles.css)

**User:** Leaderboard-Punkte-Container soll genauso breit wie der Container darüber sein.

**AI:**
- Leaderboard-Container nutzt jetzt volle Panel-Breite wie der Banner-Container. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Nach Refresh vor LockTime fehlen Rank-Picks (nur Anzeige), nach LockTime erscheinen sie wieder.

**AI:**
- Swipe-Overlay startet jetzt nur, wenn weder gespeicherte Entscheidungen noch gespeicherte Picks existieren, damit gespeicherte Ranks nicht mehr überschrieben werden. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Ranks fehlen nach Refresh weiterhin vor LockTime.

**AI:**
- In aktivem Modus werden gespeicherte Picks angezeigt, wenn lokale Picks leer sind. Umsetzung: [public/src/app.js](public/src/app.js)
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

**User:** Hottake speichern ist grau, obwohl LockTime noch nicht erreicht ist.

**AI:**
- In der Admin-UI wird der Button nur über den Spieltag-Status freigeschaltet: erlaubt sind **nur** `PENDING` oder `ACTIVE`. LockTime wird hier **nicht** geprüft. Umsetzung: [public/src/app.js](public/src/app.js#L2946-L2990)
- Beim Wechsel des Spieltags (Dropdown in „Spieltag & Sperre“) wird die Admin-Form **nicht** neu gerendert. Daher bleibt ein einmal deaktivierter Button grau, auch wenn später ein anderer Spieltag gewählt wird. Umsetzung: [public/src/app.js](public/src/app.js#L3045-L3078) und [public/src/app.js](public/src/app.js#L2946-L2990)

**User:** Nach Reload wird der falsche (finalisierte) Spieltag ausgewählt, und der Save-Button bleibt grau.

**AI:**
- Standard-Auswahl im Select bevorzugt jetzt den nächsten/aktiven Spieltag anhand der LockTime (nicht mehr den ältesten finalisierten). Umsetzung: [public/src/app.js](public/src/app.js#L61-L135) und [public/src/app.js](public/src/app.js#L1931-L1970)
- Beim Wechsel des Spieltags im Admin-Dropdown wird die Hottake-Form jetzt neu gerendert, damit der Button-Status korrekt ist. Umsetzung: [public/src/app.js](public/src/app.js#L3045-L3086)

**User:** app.js:2600 ReferenceError: hasStoredPicks is not defined

**AI:**
- In `refreshHottakes` wurde `hasStoredPicks` nur im `gameDay !== swipeGameDay`-Block deklariert, aber später immer benutzt. Fix: Flags werden vorab definiert und in beiden Pfaden gesetzt. Umsetzung: [public/src/app.js](public/src/app.js#L2527-L2599)

**User:** Das P im Leaderboard soll die gleiche Farbe wie die Platzierung (leaderboard-rank) haben.

**AI:**
- Header-Spalte „P“ nutzt jetzt die gleiche Farbe wie die Platzierungszahl über eine gezielte CSS-Override-Regel. Umsetzung: [public/src/styles.css](public/src/styles.css#L1733-L1746)

**User:** „Name“ im Leaderboard soll Groß-/Kleinschreibung behalten.

**AI:**
- Für die Header-Zelle „Name“ ist das Uppercase-Style jetzt deaktiviert (nur für diese Spalte). Umsetzung: [public/src/styles.css](public/src/styles.css#L1744-L1752)

**User:** Gäste sollen eine eigene Landing-Page ohne Hamburger bekommen, Buttons unter dem Header, Welcome-Text separat; Footer soll auf Mobile unten bleiben; Login/Register soll nicht mehr kurz blitzen.

**AI:**
- Neue Gast-Seite unter `/guest` (inkl. Welcome-Text aus Spieltag) und `/` zeigt jetzt die Gast-Landing. Umsetzung: [public/guest.html](public/guest.html) und [src/app.ts](src/app.ts#L35-L62)
- Gäste werden von Spieltag/Leaderboard/Profil/Admin zur Gast-Seite umgeleitet; eingeloggte User von `/guest` zur Spieltag-Seite. Umsetzung: [public/src/app.js](public/src/app.js#L206-L365)
- Auth-UI flackert nicht mehr: `auth-pending` blendet Header-Actions bis der Status bekannt ist. Umsetzung: [public/src/app.js](public/src/app.js#L203-L212) und [public/src/styles.css](public/src/styles.css#L79-L121)
- Footer ist jetzt sticky (Flex-Layout), damit Impressum/Datenschutz am unteren Rand bleiben. Umsetzung: [public/src/styles.css](public/src/styles.css#L64-L121)

**User:** Beim Seitenwechsel sieht man kurz „Anmelden/Registrieren“ und Leaderboard-Zeilen sind unterschiedlich hoch.

**AI:**
- Header-Actions sind nun standardmäßig versteckt, bis `auth-user`/`auth-guest` gesetzt ist. So gibt es kein „Guest-Flash“ mehr bei Page-Loads. Umsetzung: [public/src/styles.css](public/src/styles.css#L92-L130)
- Leaderboard-Zeilen haben jetzt eine feste Mindesthöhe (Header + Rows), damit alle gleich hoch wirken. Umsetzung: [public/src/styles.css](public/src/styles.css#L1694-L1756)

**User:** Zeilenhöhe im Leaderboard ist weiterhin unterschiedlich.

**AI:**
- Rows und Header bekommen jetzt eine feste Höhe (zusätzlich zur Mindesthöhe), um visuell exakt gleich hoch zu bleiben. Umsetzung: [public/src/styles.css](public/src/styles.css#L1754-L1787)

**User:** Untere Zeile im Leaderboard ist weiterhin kleiner.

**AI:**
- Zusätzliche Fixierung über `flex-basis` (flex: 0 0 ...) auf Rows und Header, damit die Flex-Column exakt gleiche Höhe erzwingt. Umsetzung: [public/src/styles.css](public/src/styles.css#L1754-L1790)

**User:** Inhalt wirkt nicht vertikal zentriert, obere Zeile hat mehr Platz unten.

**AI:**
- Rows nutzen jetzt `box-sizing: border-box`, Zellen bekommen `height: 100%` + `line-height: 1`, damit der Inhalt optisch mittig sitzt. Umsetzung: [public/src/styles.css](public/src/styles.css#L1754-L1865)

**User:** Unterste Zeile wirkt kleiner (vermutlich wegen fehlender Gap-Fläche unten).

**AI:**
- Das Leaderboard-List-Container bekommt unten `padding-bottom`, um die optische Gap auch unter der letzten Zeile zu haben. Umsetzung: [public/src/styles.css](public/src/styles.css#L1689-L1701)

**User:** Zeilen etwas niedriger und Inhalte vertikal mittig.

**AI:**
- Row/Header-Höhe reduziert und Padding angepasst; `line-height` leicht erhöht für visuelle Mitte. Umsetzung: [public/src/styles.css](public/src/styles.css#L1754-L1865)

**User:** Unten ist im Profil/Spieltag/Leaderboard zu viel Leerraum im Page-Container.

**AI:**
- Der Page-Panel-Container hat jetzt den gleichen Bottom-Abstand wie die Seitenränder, und die letzten Sections bekommen kein zusätzliches Bottom-Margin. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Auf der Spieltag-Seite ist der untere Rand noch zu groß.

**AI:**
- Der Welcome-Banner im Spieltag-Panel bekommt kein extra Bottom-Margin mehr, damit der Container unten bündig endet. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Leaderboard: Punkte-Container entfernen, Banner weg, Dropdown full-width linksbündig.

**AI:**
- Der Leaderboard-Card-Container wurde auf transparent ohne Padding/Border gesetzt, das Banner entfernt und der Spieltag-Select auf volle Breite mit linksbündigem Text gestylt. Umsetzung: [public/leaderboard.html](public/leaderboard.html), [public/src/styles.css](public/src/styles.css)

**User:** Leaderboard-Entries sollen links/rechts exakt mit dem Dropdown ausgerichtet sein.

**AI:**
- Das mobile Padding am Leaderboard-Container wurde entfernt, damit die Entries bis zu den Dropdown-Kanten reichen. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** „Punkte“ soll nicht über den Entries stehen, und das Leaderboard soll tabellarisch mit Spalten wirken.

**AI:**
- Die Überschrift wurde entfernt und das Leaderboard rendert jetzt eine Header‑Zeile mit Spalten (Platz, User, Spieltag, Gesamt) in einem Grid‑Layout. Umsetzung: [public/src/app.js](public/src/app.js), [public/src/styles.css](public/src/styles.css)

**User:** Spaltennamen sollen kurz sein: P, Name, S, G.

**AI:**
- Die Header-Texte wurden auf P, Name, S und G gekürzt. Umsetzung: [public/src/app.js](public/src/app.js)

**User:** Leaderboard: Name wird abgeschnitten, Rank-Kreis weg, Header im Container und subtile Linien.

**AI:**
- Der Rank-Kreis wurde entfernt und die Spaltenbreite reduziert, damit mehr Platz für Namen entsteht. Die Header-Zeile bleibt im Container, und das Leaderboard hat jetzt dezente Trennlinien innerhalb eines Tabellen-Containers. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Spaltenüberschriften zentrieren, S/G nur Platz für "XXX P".

**AI:**
- Header-Zellen sind jetzt zentriert, und die S/G-Spaltenbreite wurde auf 3-stellige Werte plus Suffix abgestimmt (inkl. Responsive). Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** Header-Alignment: P/S/G zentriert, Name links; Zeileninhalte gleiche Höhe/Schrift.

**AI:**
- Header-Alignment pro Spalte korrigiert und Zeilen-Typografie mit einheitlicher Schriftgröße/Line-Height vereinheitlicht. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** P/S/G zentriert über Inhalten; Spaltenbreite soll sich an 2- oder 3-stelligen Werten orientieren.

**AI:**
- S/G-Spalten sind jetzt zentriert und bekommen digit-aware Breiten (2- oder 3-stellig), inkl. Responsive. Umsetzung: [public/src/app.js](public/src/app.js), [public/src/styles.css](public/src/styles.css)

**User:** Spieltag: Banner-Änderungen wie im Leaderboard, Dropdown größer, Lock-Notiz volle Breite.

**AI:**
- Der Spieltag-Banner wurde entfernt, das Dropdown läuft jetzt vollbreit, und die Lock-Notizen füllen die Container-Breite. Umsetzung: [public/spieltag.html](public/spieltag.html), [public/src/styles.css](public/src/styles.css)

**User:** Mehr Abstand zwischen Dropdown und Notiz, weniger zwischen Notiz und Ranks.

**AI:**
- Abstand nach oben in der Notiz erhöht und der Abstand zum Ranks-Container reduziert. Umsetzung: [public/src/styles.css](public/src/styles.css)

**User:** H2 im Ranks-Container soll zentriert sein.

**AI:**
- Die Ranks-Überschrift wird jetzt im Header zentriert. Umsetzung: [public/src/styles.css](public/src/styles.css)

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

### 2026-02-03

**User:** Layout-Refactor: eigene Seiten (Spieltag, Leaderboard, Profil, Admin), globaler Auswahl-Container, Dropdown-Menu, schöne Pfade ohne .html.

**AI:**
- Multi-Page Struktur angelegt (spieltag.html, leaderboard.html, profil.html, admin.html) mit shared Header/Dropdown-Menu und globalem Select-Container auf Spieltag/Leaderboard/Admin. Profil bündelt Settings + Nickname-Icon. Umsetzung: [public/spieltag.html](public/spieltag.html), [public/leaderboard.html](public/leaderboard.html), [public/profil.html](public/profil.html), [public/admin.html](public/admin.html)
- Pretty paths via Express-Routes (z. B. `/spieltag`, `/leaderboard`, `/profil`, `/admin`, `/login`) und Fallback auf spieltag.html. Umsetzung: [src/app.ts](src/app.ts)
- `app.js` seitenfähig gemacht (page flags, Dropdown-Nav, Admin-Only Menu Item, game-only init). Umsetzung: [public/src/app.js](public/src/app.js)

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



