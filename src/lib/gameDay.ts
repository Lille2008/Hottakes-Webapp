import prisma from './db';

export const GAME_DAY_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FINALIZED: 'FINALIZED',
  ARCHIVED: 'ARCHIVED'
} as const;

export type GameDayStatus = (typeof GAME_DAY_STATUS)[keyof typeof GAME_DAY_STATUS];

/**
 * Finds the current game day number based on time-based logic.
 * Does NOT modify game day statuses in the database.
 * 
 * Logic determines the "current" game day as:
 * - Priority 1: A game day that is locked but not finalized (currently in progress)
 * - Priority 2: The next upcoming game day (has future lock time or no lock time)
 */
export async function findCurrentGameDayNumber(): Promise<number | null> {
  const now = new Date();

  // Get all game days that are not already finalized or archived
  const gameDays = await prisma.gameDay.findMany({
    where: {
      status: {
        notIn: [GAME_DAY_STATUS.FINALIZED, GAME_DAY_STATUS.ARCHIVED]
      }
    },
    orderBy: [
      { lockTime: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  if (gameDays.length === 0) {
    return null;
  }

  // Priority 1: A game day that is locked but not finalized (currently in progress)
  // If multiple exist, take the first one (earliest lock time) as it started first
  let currentGameDay = gameDays.find(
    (gd) => gd.lockTime && gd.lockTime <= now && !gd.finalizedAt
  );

  // Priority 2: If no in-progress game day, use the next upcoming game day
  if (!currentGameDay) {
    // Find the earliest game day with future lock time or no lock time
    currentGameDay = gameDays.find(
      (gd) => !gd.lockTime || gd.lockTime > now
    );
  }

  return currentGameDay?.gameDay ?? null;
}

export async function resolveGameDayParam(raw: unknown): Promise<number> {
  if (typeof raw === 'string' && raw.length > 0) {
    if (raw === 'active') {
      const current = await findCurrentGameDayNumber();
      if (current === null) {
        throw new Error('Kein aktiver Spieltag vorhanden.');
      }
      return current;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      throw new Error('Ungültiger Spieltag-Parameter');
    }
    return parsed;
  }

  const current = await findCurrentGameDayNumber();
  if (current === null) {
    throw new Error('Kein aktiver Spieltag vorhanden.');
  }

  return current;
}

export async function getGameDayByNumber(gameDay: number) {
  const event = await prisma.gameDay.findUnique({ where: { gameDay } });
  if (!event) {
    throw new Error('Spieltag nicht gefunden.');
  }
  return event;
}
