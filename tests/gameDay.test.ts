import type { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let findCurrentGameDayNumber: typeof import('../src/lib/gameDay').findCurrentGameDayNumber;
let GAME_DAY_STATUS: typeof import('../src/lib/gameDay').GAME_DAY_STATUS;

const truncateTables = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "submissions", "users", "hottakes", "settings", "gamedays" RESTART IDENTITY CASCADE;'
  );
};

beforeAll(async () => {
  const [{ default: prismaClient }, gameDayModule] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/gameDay')
  ]);
  prisma = prismaClient;
  findCurrentGameDayNumber = gameDayModule.findCurrentGameDayNumber;
  GAME_DAY_STATUS = gameDayModule.GAME_DAY_STATUS;
});

beforeEach(async () => {
  await truncateTables();
});

describe('findCurrentGameDayNumber', () => {
  it('should return null when no game days exist', async () => {
    const result = await findCurrentGameDayNumber();
    expect(result).toBeNull();
  });

  it('should return the active game day with future lock time', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    
    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'Test Game Day 1',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: futureDate
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(1);
  });

  it('should return game day that is in progress (locked but not finalized)', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow

    // Create game day 1 with lock time in the past (in progress)
    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'In Progress Game Day',
        status: GAME_DAY_STATUS.PENDING, // Status doesn't matter, will be updated
        lockTime: pastDate
      }
    });

    // Create game day 2 with lock time in the future (upcoming)
    await prisma.gameDay.create({
      data: {
        gameDay: 2,
        description: 'Future Game Day',
        status: GAME_DAY_STATUS.PENDING,
        lockTime: futureDate
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(1); // Should return game day 1 (in progress)
  });

  it('should return the earliest active game day when multiple have future lock times', async () => {
    const futureDate1 = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    const futureDate2 = new Date(Date.now() + 48 * 60 * 60 * 1000); // day after tomorrow

    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'Earlier Game Day',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: futureDate1
      }
    });

    await prisma.gameDay.create({
      data: {
        gameDay: 2,
        description: 'Later Game Day',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: futureDate2
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(1); // Should return the earlier game day
  });

  it('should ignore finalized game days', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'Finalized Game Day',
        status: GAME_DAY_STATUS.FINALIZED,
        lockTime: pastDate
      }
    });

    await prisma.gameDay.create({
      data: {
        gameDay: 2,
        description: 'Active Game Day',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: futureDate
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(2);
  });

  it('should return upcoming game day when all past game days are finalized', async () => {
    const pastDate1 = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pastDate2 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create finalized past game days
    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'Finalized Game Day 1',
        status: GAME_DAY_STATUS.FINALIZED,
        lockTime: pastDate1,
        finalizedAt: pastDate1
      }
    });

    await prisma.gameDay.create({
      data: {
        gameDay: 2,
        description: 'Finalized Game Day 2',
        status: GAME_DAY_STATUS.FINALIZED,
        lockTime: pastDate2,
        finalizedAt: pastDate2
      }
    });

    // Create upcoming game day
    await prisma.gameDay.create({
      data: {
        gameDay: 3,
        description: 'Upcoming Game Day',
        status: GAME_DAY_STATUS.PENDING,
        lockTime: futureDate
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(3); // Should return the upcoming game day
  });

  it('should return the earliest locked game day that is not finalized', async () => {
    const pastDate1 = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pastDate2 = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'Older Locked Game Day',
        status: GAME_DAY_STATUS.PENDING,
        lockTime: pastDate1
      }
    });

    await prisma.gameDay.create({
      data: {
        gameDay: 2,
        description: 'More Recent Locked Game Day',
        status: GAME_DAY_STATUS.PENDING,
        lockTime: pastDate2
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(1); // Should return the earliest locked game day (first in progress)
  });

  it('should return active game day with null lock time', async () => {
    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'No Lock Time',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: null
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(1);
  });

  it('should prefer game day with lock time over null lock time', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.gameDay.create({
      data: {
        gameDay: 1,
        description: 'No Lock Time',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: null
      }
    });

    await prisma.gameDay.create({
      data: {
        gameDay: 2,
        description: 'With Lock Time',
        status: GAME_DAY_STATUS.ACTIVE,
        lockTime: futureDate
      }
    });

    const result = await findCurrentGameDayNumber();
    expect(result).toBe(2); // Should return the one with lock time
  });
});
