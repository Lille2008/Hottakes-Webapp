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



