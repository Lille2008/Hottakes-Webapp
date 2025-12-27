import prisma from './db';

export async function findCurrentGameDayNumber(): Promise<number | null> {
  const now = new Date();

  const upcoming = await prisma.adminEvent.findFirst({
    where: { activeFlag: true, lockTime: { not: null, gt: now } },
    orderBy: { lockTime: 'asc' }
  });

  if (upcoming) {
    return upcoming.gameDay;
  }

  const fallback = await prisma.adminEvent.findFirst({
    where: { activeFlag: true },
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
  const event = await prisma.adminEvent.findUnique({ where: { gameDay } });
  if (!event) {
    throw new Error('Spieltag nicht gefunden.');
  }
  return event;
}
