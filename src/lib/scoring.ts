const SCORE_BY_POSITION = [3, 2, 1];

export type HottakeOutcome = {
  id: number;
  status: 'OFFEN' | 'WAHR' | 'FALSCH';
};

export type SwipeDecision = {
  hottakeId: number;
  decision: 'hit' | 'pass' | 'skip';
};

export function calculateScore(
  picks: number[],
  hottakes: HottakeOutcome[],
  swipeDecisions: SwipeDecision[] = []
): number {
  if (!Array.isArray(picks)) {
    return 0;
  }

  const map = new Map(hottakes.map((hot) => [hot.id, hot.status]));
  const decisionMap = new Map(swipeDecisions.map((decision) => [decision.hottakeId, decision.decision]));
  let total = 0;

  // Swipe points: +1 for each correct decision (WAHR -> hit, FALSCH -> pass)
  // This is separate from the ranking bonus points.
  const isCorrectDecision = (status: HottakeOutcome['status'], decision?: SwipeDecision['decision']) => {
    if (!decision) {
      return false;
    }
    if (decision === 'skip') {
      return false;
    }
    return (status === 'WAHR' && decision === 'hit') || (status === 'FALSCH' && decision === 'pass');
  };

  for (const [hottakeId, decision] of decisionMap.entries()) {
    const status = map.get(hottakeId);
    if (status && isCorrectDecision(status, decision)) {
      total += 1;
    }
  }

  for (let i = 0; i < picks.length; i += 1) {
    const pickId = picks[i];
    if (typeof pickId !== 'number') {
      continue;
    }

    const status = map.get(pickId);
    const decision = decisionMap.get(pickId);
    if (status && isCorrectDecision(status, decision)) {
      total += SCORE_BY_POSITION[i] ?? 0;
    }
  }

  return total;
}
