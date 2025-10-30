// Erzeugt die Rangliste anhand der gespeicherten Submissions und des aktuellen Hottake-Status.
// Holt dazu die relevanten Daten aus der DB und nutzt das Scoring-Modul.
import prisma from './db';
import { calculateScore, type HottakeOutcome } from './scoring';

// Publices Datentransferobjekt (DTO) der Leaderboard-Einträge
export type LeaderboardEntry = {
  nickname: string;
  score: number;
  submittedAt: Date;
};

export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
  // Nur das Nötigste laden (id/status), um Scoring effizient zu halten
  const hottakesRaw = await prisma.hottake.findMany({
    select: { id: true, status: true }
  });

  // Submissions inkl. User (für Nickname)
  const submissions = await prisma.submission.findMany({
    include: { user: true }
  });

  // In das für die Auswertung erwartete Minimalformat transformieren
  const mappedHottakes: HottakeOutcome[] = hottakesRaw.map((hot: (typeof hottakesRaw)[number]): HottakeOutcome => ({
    id: hot.id,
    status: hot.status
  }));

  // Punkte für jede Submission berechnen und DTO bauen
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

  // Sortierung: primär nach Score absteigend, sekundär nach Einreichzeit aufsteigend (früher gewinnt bei Gleichstand)
  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });
}
