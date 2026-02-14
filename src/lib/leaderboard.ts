import prisma from './db';
import { GAME_DAY_STATUS } from './gameDay';
import { calculateScore, type HottakeOutcome, type SwipeDecision } from './scoring';

export type LeaderboardEntry = {
  nickname: string;
  score: number;
  submittedAt: Date;
  gameDay: number;
};

export async function buildLeaderboard(gameDay: number): Promise<LeaderboardEntry[]> {
  const hottakesRaw = await prisma.hottake.findMany({
    where: { gameDay },
    select: { id: true, status: true }
  });

  const submissions = await prisma.submission.findMany({
    where: { gameDay },
    include: { user: true },
    orderBy: { updatedAt: 'desc' }
  });

  const mappedHottakes: HottakeOutcome[] = hottakesRaw.map((hot: (typeof hottakesRaw)[number]): HottakeOutcome => ({
    id: hot.id,
    status: hot.status
  }));

  const perUser = new Map<number, LeaderboardEntry>();

  for (const submission of submissions) {
    const storedDecisions = Array.isArray(submission.swipeDecisions)
      ? (submission.swipeDecisions as SwipeDecision[])
      : [];
    const score = calculateScore(submission.picks, mappedHottakes, storedDecisions);
    const nickname = submission.user?.nickname || 'Unknown';

    if (score !== submission.score) {
      await prisma.submission.update({
        where: { userId_gameDay: { userId: submission.userId, gameDay } },
        data: { score }
      });
    }

    const existing = perUser.get(submission.userId);
    const isNewer = !existing || submission.updatedAt.getTime() >= existing.submittedAt.getTime();

    if (isNewer) {
      perUser.set(submission.userId, {
        nickname,
        score,
        submittedAt: submission.updatedAt,
        gameDay
      });
    }
  }

  const entries: LeaderboardEntry[] = Array.from(perUser.values());

  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });
}

export async function buildLeaderboardAll(): Promise<LeaderboardEntry[]> {
  // Hole alle Spieltage, deren lockTime erreicht wurde (in der Vergangenheit liegt)
  const now = new Date();
  const eligibleGameDays = await prisma.gameDay.findMany({
    where: {
      lockTime: {
        not: null,
        lte: now  // lockTime muss in der Vergangenheit liegen
      }
    },
    select: { gameDay: true }
  });

  const eligibleIds = eligibleGameDays.map((g) => g.gameDay);
  if (eligibleIds.length === 0) {
    return [];
  }

  const hottakesRaw = await prisma.hottake.findMany({
    where: { gameDay: { in: eligibleIds } },
    select: { id: true, status: true, gameDay: true }
  });

  const hottakesByGameDay = new Map<number, HottakeOutcome[]>();
  for (const hot of hottakesRaw) {
    const list = hottakesByGameDay.get(hot.gameDay) ?? [];
    list.push({ id: hot.id, status: hot.status });
    hottakesByGameDay.set(hot.gameDay, list);
  }

  const submissions = await prisma.submission.findMany({
    where: { gameDay: { in: eligibleIds } },
    include: { user: true },
    orderBy: { updatedAt: 'desc' }
  });

  const totals = new Map<number, { nickname: string; score: number; submittedAt: Date }>();

  for (const submission of submissions) {
    const mappedHottakes = hottakesByGameDay.get(submission.gameDay) ?? [];
    const storedDecisions = Array.isArray(submission.swipeDecisions)
      ? (submission.swipeDecisions as SwipeDecision[])
      : [];
    const score = calculateScore(submission.picks, mappedHottakes, storedDecisions);
    const nickname = submission.user?.nickname || 'Unknown';

    if (score !== submission.score) {
      await prisma.submission.update({
        where: { userId_gameDay: { userId: submission.userId, gameDay: submission.gameDay } },
        data: { score }
      });
    }

    const existing = totals.get(submission.userId);
    const firstSubmittedAt = existing
      ? new Date(Math.min(existing.submittedAt.getTime(), submission.updatedAt.getTime()))
      : submission.updatedAt;

    totals.set(submission.userId, {
      nickname,
      score: (existing?.score ?? 0) + score,
      submittedAt: firstSubmittedAt
    });
  }

  const entries: LeaderboardEntry[] = Array.from(totals.entries()).map(([_, payload]) => ({
    nickname: payload.nickname,
    score: payload.score,
    submittedAt: payload.submittedAt,
    gameDay: -1
  }));

  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });
}
