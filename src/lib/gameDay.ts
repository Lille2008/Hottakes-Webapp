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
 * - Priority 1: A game day that is locked but not finalized (lockTime in past)
 * - Priority 2: The next upcoming game day within 5 days (lockTime within 5 days)
 * 
 * Game days more than 5 days in the future are NOT considered active.
 */
export async function findCurrentGameDayNumber(): Promise<number | null> {
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  // Find game day that is either:
  // 1. Locked (lockTime in past) but not finalized
  // 2. Locktime within 5 days (about to lock)
  const activeOrUpcoming = await prisma.gameDay.findFirst({
    where: { 
      status: GAME_DAY_STATUS.ACTIVE,
      lockTime: {
        not: null,
        lte: fiveDaysFromNow  // lockTime is now or within 5 days
      }
    },
    orderBy: { lockTime: 'asc' }
  });

  if (activeOrUpcoming) {
    return activeOrUpcoming.gameDay;
  }

  // Fallback: return any active game day (shouldn't normally happen)
  const fallback = await prisma.gameDay.findFirst({
    where: { status: GAME_DAY_STATUS.ACTIVE },
    orderBy: [{ lockTime: 'asc' }, { createdAt: 'asc' }]
  });

  return fallback?.gameDay ?? null;
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
