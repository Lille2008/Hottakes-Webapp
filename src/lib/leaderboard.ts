import prisma from './db';
import { calculateScore, type HottakeOutcome } from './scoring';

export type LeaderboardEntry = {
  nickname: string;
  score: number;
  submittedAt: Date;
};

export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
  const hottakesRaw = await prisma.hottake.findMany({
    select: { id: true, status: true }
  });

  const submissions = await prisma.submission.findMany({
    include: { user: true }
  });

  const mappedHottakes: HottakeOutcome[] = hottakesRaw.map((hot: (typeof hottakesRaw)[number]): HottakeOutcome => ({
    id: hot.id,
    status: hot.status
  }));

  const entries: LeaderboardEntry[] = submissions.map(
    (submission: (typeof submissions)[number]): LeaderboardEntry => {
    const score = calculateScore(submission.picks, mappedHottakes);
    return {
      nickname: submission.user.nickname,
      score,
      submittedAt: submission.updatedAt
    };
    }
  );

  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });
}
