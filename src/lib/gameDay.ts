import prisma from './db';

export const GAME_DAY_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FINALIZED: 'FINALIZED',
  ARCHIVED: 'ARCHIVED'
} as const;

export type GameDayStatus = (typeof GAME_DAY_STATUS)[keyof typeof GAME_DAY_STATUS];

/**
 * Automatically manages game day statuses based on current time.
 * Ensures only one game day is marked as ACTIVE at a time.
 * 
 * Logic:
 * 1. The "current" game day should be ACTIVE
 * 2. All others should be PENDING (or FINALIZED/ARCHIVED if already done)
 * 
 * Current game day is determined by:
 * - Priority 1: A game day that is locked but not finalized (currently in progress)
 * - Priority 2: The next upcoming game day (has future lock time or no lock time)
 */
export async function updateGameDayStatuses(): Promise<void> {
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
    return;
  }

  // Find the game day that should be ACTIVE
  
  // Priority 1: A game day that is locked but not finalized (currently in progress)
  let targetActiveGameDay = gameDays.find(
    (gd) => gd.lockTime && gd.lockTime <= now && !gd.finalizedAt
  );

  // Priority 2: If no in-progress game day, use the next upcoming game day
  if (!targetActiveGameDay) {
    // Find the earliest game day with future lock time or no lock time
    targetActiveGameDay = gameDays.find(
      (gd) => !gd.lockTime || gd.lockTime > now
    );
  }

  // Update statuses in batch
  const updates: Promise<unknown>[] = [];

  for (const gameDay of gameDays) {
    const shouldBeActive = targetActiveGameDay && gameDay.id === targetActiveGameDay.id;
    const currentlyActive = gameDay.status === GAME_DAY_STATUS.ACTIVE;

    if (shouldBeActive && !currentlyActive) {
      updates.push(
        prisma.gameDay.update({
          where: { id: gameDay.id },
          data: { status: GAME_DAY_STATUS.ACTIVE }
        })
      );
    } else if (!shouldBeActive && currentlyActive) {
      updates.push(
        prisma.gameDay.update({
          where: { id: gameDay.id },
          data: { status: GAME_DAY_STATUS.PENDING }
        })
      );
    }
  }

  await Promise.all(updates);
}

/**
 * Finds the currently active game day number.
 * First updates game day statuses, then returns the active one.
 */
export async function findCurrentGameDayNumber(): Promise<number | null> {
  // Update statuses to ensure correctness
  await updateGameDayStatuses();

  // Now find the ACTIVE game day
  const activeGameDay = await prisma.gameDay.findFirst({
    where: { status: GAME_DAY_STATUS.ACTIVE }
  });

  return activeGameDay?.gameDay ?? null;
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
