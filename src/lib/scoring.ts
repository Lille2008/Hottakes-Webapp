const SCORE_BY_POSITION = [5, 4, 3, 2, 1];

export type HottakeCorrectness = {
  id: number;
  correct: boolean;
};

export function calculateScore(picks: number[], hottakes: HottakeCorrectness[]): number {
  if (!Array.isArray(picks)) {
    return 0;
  }

  const map = new Map(hottakes.map((hot) => [hot.id, hot.correct]));
  let total = 0;

  for (let i = 0; i < picks.length; i += 1) {
    const pickId = picks[i];
    if (typeof pickId !== 'number') {
      continue;
    }

  const isCorrect = map.get(pickId);
  if (isCorrect === true) {
      total += SCORE_BY_POSITION[i] ?? 0;
    }
  }

  return total;
}
