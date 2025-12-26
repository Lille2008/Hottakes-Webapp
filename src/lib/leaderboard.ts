import prisma from './db';
import { calculateScore, type HottakeOutcome } from './scoring';

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
    include: { user: true }
  });

  const mappedHottakes: HottakeOutcome[] = hottakesRaw.map((hot: (typeof hottakesRaw)[number]): HottakeOutcome => ({
    id: hot.id,
    status: hot.status
  }));

  const entries: LeaderboardEntry[] = [];

  for (const submission of submissions) {
    const score = calculateScore(submission.picks, mappedHottakes);
    const nickname = submission.user?.nickname || 'Unknown';

    if (score !== submission.score) {
      await prisma.submission.update({
        where: { userId_gameDay: { userId: submission.userId, gameDay } },
        data: { score }
      });
    }

    entries.push({
      nickname,
      score,
      submittedAt: submission.updatedAt,
      gameDay
    });
  }

  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });
}

export async function buildLeaderboardAll(): Promise<LeaderboardEntry[]> {
  const hottakesRaw = await prisma.hottake.findMany({
    select: { id: true, status: true, gameDay: true }
  });

  const hottakesByGameDay = new Map<number, HottakeOutcome[]>();
  for (const hot of hottakesRaw) {
    const list = hottakesByGameDay.get(hot.gameDay) ?? [];
    list.push({ id: hot.id, status: hot.status });
    hottakesByGameDay.set(hot.gameDay, list);
  }

  const submissions = await prisma.submission.findMany({ include: { user: true } });

  const totals = new Map<string, { score: number; submittedAt: Date }>();

  for (const submission of submissions) {
    const mappedHottakes = hottakesByGameDay.get(submission.gameDay) ?? [];
    const score = calculateScore(submission.picks, mappedHottakes);
    const nickname = submission.user?.nickname || 'Unknown';

    if (score !== submission.score) {
      await prisma.submission.update({
        where: { userId_gameDay: { userId: submission.userId, gameDay: submission.gameDay } },
        data: { score }
      });
    }

    const existing = totals.get(nickname);
    const firstSubmittedAt = existing ? new Date(Math.min(existing.submittedAt.getTime(), submission.updatedAt.getTime())) : submission.updatedAt;

    totals.set(nickname, {
      score: (existing?.score ?? 0) + score,
      submittedAt: firstSubmittedAt
    });
  }

  const entries: LeaderboardEntry[] = Array.from(totals.entries()).map(([nickname, payload]) => ({
    nickname,
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
