import prisma from './db';
import { calculateScore, type HottakeCorrectness } from './scoring';

export type LeaderboardEntry = {
  nickname: string;
  score: number;
  submittedAt: Date;
};

export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
  const hottakesRaw = await prisma.hottake.findMany({
    where: { isActive: true },
    select: { id: true, correct: true }
  });

  const submissions = await prisma.submission.findMany({
    include: { user: true }
  });

  const mappedHottakes: HottakeCorrectness[] = hottakesRaw.map((hot): HottakeCorrectness => ({
    id: hot.id,
    correct: hot.correct
  }));

  const entries: LeaderboardEntry[] = submissions.map((submission): LeaderboardEntry => {
    const score = calculateScore(submission.picks, mappedHottakes);
    return {
      nickname: submission.user.nickname,
      score,
      submittedAt: submission.updatedAt
    };
  });

  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });
}
