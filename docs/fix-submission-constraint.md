# Fix für Submission Unique Constraint Fehler

## Problem

Bei dem Versuch, 5 Hottakes einzuranken, tritt folgender Fehler auf:

```
Invalid `prisma.submission.upsert()` invocation:
Unique constraint failed on the fields: (`userId`)
```

## Ursache

Dieser Fehler tritt auf, wenn die Datenbank eine alte Unique-Constraint nur auf dem `userId`-Feld hat, anstatt auf der korrekten Kombination `[userId, gameDay]`.

Das aktuelle Schema definiert korrekt:
```prisma
@@unique([userId, gameDay])
```

Dies erlaubt einem User, mehrere Submissions für verschiedene Spieltage zu haben, aber nur eine pro Spieltag.

Falls die Datenbank jedoch eine alte Constraint nur auf `userId` hat, schlägt der Upsert-Vorgang fehl, sobald ein User bereits eine Submission für irgendeinen Spieltag hat.

## Lösung

### Option 1: Automatisches Migration-Script ausführen

Wir haben ein Migration-Script erstellt, das:
1. Nach alten Unique-Constraints auf `userId` allein sucht
2. Diese entfernt
3. Sicherstellt, dass die korrekte Composite-Constraint `[userId, gameDay]` existiert

**Ausführung:**

```bash
npm run fix:submission-constraint
```

Das Script gibt detaillierte Informationen darüber aus, was es tut:
- Welche Constraints vor dem Fix existieren
- Welche Constraints entfernt werden
- Welche Constraints nach dem Fix existieren

### Option 2: Manuelle SQL-Migration

Falls Sie die Migration manuell ausführen möchten, können Sie direkt auf die Datenbank zugreifen:

```sql
-- 1. Prüfen, welche Unique-Constraints existieren
SELECT 
  con.conname as constraint_name,
  con.contype as constraint_type
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'submissions'
  AND nsp.nspname = 'public'
  AND con.contype = 'u'
ORDER BY con.conname;

-- 2. Falls eine Constraint nur auf userId existiert, diese entfernen
-- (Name variiert, z.B. "submissions_userId_key")
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_userId_key";

-- 3. Sicherstellen, dass die Composite-Constraint existiert
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_userId_gameDay_key" 
ON "submissions"("userId", "gameDay");
```

## Verification

Nach dem Ausführen der Migration sollten Sie in der Lage sein:
- Mehrere Submissions für denselben User über verschiedene Spieltage hinweg zu erstellen
- Existierende Submissions für denselben User und Spieltag zu aktualisieren
- Keine Konflikte zwischen verschiedenen Usern zu haben

### Tests ausführen

Sie können die Tests ausführen, um zu überprüfen, dass alles funktioniert:

```bash
npm test -- tests/submission-constraint.test.ts
```

Diese Tests überprüfen:
1. ✅ Derselbe User kann Picks für verschiedene Spieltage abgeben
2. ✅ Derselbe User kann seine Submission für denselben Spieltag aktualisieren
3. ✅ Verschiedene User können Submissions für denselben Spieltag haben

## Für Entwickler: Was wurde geändert?

1. **Migration-Script**: `scripts/fix-submission-constraint.ts`
   - Erkennt und entfernt alte Constraints auf `userId`
   - Stellt sicher, dass die Composite-Constraint existiert

2. **Tests**: `tests/submission-constraint.test.ts`
   - Umfassende Tests für Multi-GameDay-Szenarien
   - Überprüfung des Upsert-Verhaltens

3. **NPM-Script**: `package.json`
   - Neues Kommando: `npm run fix:submission-constraint`

## Weitere Informationen

- Das aktuelle Schema ist in `prisma/schema.prisma` definiert
- Die Submission-Route ist in `src/routes/submissions.ts` implementiert
- Der Upsert-Vorgang verwendet den korrekten Composite-Key: `userId_gameDay`
