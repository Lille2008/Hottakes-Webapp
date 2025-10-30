// Punkteschema: Index 0 -> 5 Punkte, Index 1 -> 4 Punkte, ...
// So werden frühere Picks höher gewichtet als spätere.
const SCORE_BY_POSITION = [5, 4, 3, 2, 1];

// Minimales Ergebnisformat für die Auswertung der Hottakes
export type HottakeOutcome = {
  id: number;
  status: 'OFFEN' | 'WAHR' | 'FALSCH';
};

// Berechnet die Gesamtpunktzahl für gegebene Picks und die bekannten Hottake-Ausgänge.
// - picks: IDs der ausgewählten Hottakes in Reihenfolge (höhere Priorität zuerst)
// - hottakes: Liste (id, status), um schnell zu prüfen, ob ein Pick "WAHR" war
export function calculateScore(picks: number[], hottakes: HottakeOutcome[]): number {
  if (!Array.isArray(picks)) {
    return 0;
  }

  // Map zur schnellen Status-Abfrage
  const map = new Map(hottakes.map((hot) => [hot.id, hot.status]));
  let total = 0;

  for (let i = 0; i < picks.length; i += 1) {
    const pickId = picks[i];
    if (typeof pickId !== 'number') {
      continue; // ungültiger Eintrag wird ignoriert
    }

    const status = map.get(pickId);
    if (status === 'WAHR') {
      total += SCORE_BY_POSITION[i] ?? 0; // Safety: falls picks länger als SCORE_BY_POSITION ist
    }
  }

  return total;
}
