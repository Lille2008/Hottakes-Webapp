import prisma from './db';

export const GAME_DAY_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FINALIZED: 'FINALIZED',
  ARCHIVED: 'ARCHIVED'
} as const;

export type GameDayStatus = (typeof GAME_DAY_STATUS)[keyof typeof GAME_DAY_STATUS];

export async function findCurrentGameDayNumber(): Promise<number | null> {
  const now = new Date();

  // Find ACTIVE game days that haven't locked yet
  // Either lockTime is null or lockTime is in the future
  const activeGameDay = await prisma.gameDay.findFirst({
    where: {
      status: GAME_DAY_STATUS.ACTIVE,
      OR: [
        { lockTime: null },
        { lockTime: { gt: now } }
      ]
    },
    orderBy: [
      { lockTime: 'asc' },
      { createdAt: 'asc' }
    ]
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
