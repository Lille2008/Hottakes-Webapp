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
