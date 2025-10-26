const SCORE_BY_POSITION = [5, 4, 3, 2, 1];

export type HottakeOutcome = {
  id: number;
  status: 'OFFEN' | 'WAHR' | 'FALSCH';
};

export function calculateScore(picks: number[], hottakes: HottakeOutcome[]): number {
  if (!Array.isArray(picks)) {
    return 0;
  }

  const map = new Map(hottakes.map((hot) => [hot.id, hot.status]));
  let total = 0;

  for (let i = 0; i < picks.length; i += 1) {
    const pickId = picks[i];
    if (typeof pickId !== 'number') {
      continue;
    }

    const status = map.get(pickId);
    if (status === 'WAHR') {
      total += SCORE_BY_POSITION[i] ?? 0;
    }
  }

  return total;
}
