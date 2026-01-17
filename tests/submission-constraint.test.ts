import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

let app: Express;
let prisma: PrismaClient;

const truncateTables = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "submissions", "users", "hottakes", "settings", "gamedays" RESTART IDENTITY CASCADE;'
  );
};

const ensureGameDay = async (
  gameDay: number,
  overrides: Partial<{
    lockTime: Date | null;
    status: 'PENDING' | 'ACTIVE' | 'FINALIZED' | 'ARCHIVED';
    description: string;
    startTime: Date | null;
    finalizedAt: Date | null;
  }> = {}
) => {
  await prisma.gameDay.upsert({
    where: { gameDay },
    create: {
      gameDay,
      description: overrides.description ?? `Test Spieltag ${gameDay}`,
      status: overrides.status ?? 'ACTIVE',
      lockTime: overrides.lockTime ?? null,
      startTime: overrides.startTime ?? null,
      finalizedAt: overrides.finalizedAt ?? null
    },
    update: {
      description: overrides.description ?? `Test Spieltag ${gameDay}`,
      status: overrides.status ?? 'ACTIVE',
      lockTime: overrides.lockTime ?? null,
      startTime: overrides.startTime ?? null,
      finalizedAt: overrides.finalizedAt ?? null
    }
  });
};

beforeAll(async () => {
  process.env.ADMIN_PASSWORD = 'secret-admin';
  process.env.ADMIN_NICKNAME = 'lille08';
  process.env.JWT_SECRET = 'test-secret-key';

  const [{ default: importedApp }, { default: prismaClient }] = await Promise.all([
    import('../src/app'),
    import('../src/lib/db')
  ]);

  app = importedApp;
  prisma = prismaClient;
});

beforeEach(async () => {
  await truncateTables();
  await ensureGameDay(0);
  await ensureGameDay(1);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Submission Constraint Tests', () => {
  it('should allow the same user to submit picks for different game days', async () => {
    const agent = request.agent(app);

    // Register a user
    await agent
      .post('/api/auth/register')
      .send({ nickname: 'TestUser', email: 'test@example.com', password: 'password123' })
      .expect(201);

    // Create 10 hottakes for game day 0
    const hottakesGameDay0 = await Promise.all(
      Array.from({ length: 10 }).map((_, index) =>
        prisma.hottake.create({ data: { text: `GameDay 0 Hottake ${index + 1}`, status: 'OFFEN', gameDay: 0 } })
      )
    );

    // Create 10 hottakes for game day 1
    const hottakesGameDay1 = await Promise.all(
      Array.from({ length: 10 }).map((_, index) =>
        prisma.hottake.create({ data: { text: `GameDay 1 Hottake ${index + 1}`, status: 'OFFEN', gameDay: 1 } })
      )
    );

    // Submit picks for game day 0
    const picksGameDay0 = hottakesGameDay0.slice(0, 5).map((h) => h.id);
    const submission0Response = await agent
      .post('/api/submissions?gameDay=0')
      .send({ picks: picksGameDay0 })
      .expect(201);

    expect(submission0Response.body).toMatchObject({
      nickname: 'TestUser',
      picks: picksGameDay0,
      gameDay: 0
    });

    // Submit picks for game day 1 (should NOT fail with unique constraint error)
    const picksGameDay1 = hottakesGameDay1.slice(0, 5).map((h) => h.id);
    const submission1Response = await agent
      .post('/api/submissions?gameDay=1')
      .send({ picks: picksGameDay1 })
      .expect(201);

    expect(submission1Response.body).toMatchObject({
      nickname: 'TestUser',
      picks: picksGameDay1,
      gameDay: 1
    });

    // Verify both submissions exist in the database
    const submissions = await prisma.submission.findMany({
      where: { user: { nickname: 'TestUser' } },
      orderBy: { gameDay: 'asc' }
    });

    expect(submissions).toHaveLength(2);
    expect(submissions[0].gameDay).toBe(0);
    expect(submissions[0].picks).toEqual(picksGameDay0);
    expect(submissions[1].gameDay).toBe(1);
    expect(submissions[1].picks).toEqual(picksGameDay1);
  });

  it('should allow updating the same user submission for the same game day', async () => {
    const agent = request.agent(app);

    // Register a user
    await agent
      .post('/api/auth/register')
      .send({ nickname: 'UpdateUser', email: 'update@example.com', password: 'password123' })
      .expect(201);

    // Create 10 hottakes for game day 0
    const hottakes = await Promise.all(
      Array.from({ length: 10 }).map((_, index) =>
        prisma.hottake.create({ data: { text: `Hottake ${index + 1}`, status: 'OFFEN', gameDay: 0 } })
      )
    );

    // Submit initial picks
    const initialPicks = hottakes.slice(0, 5).map((h) => h.id);
    await agent
      .post('/api/submissions?gameDay=0')
      .send({ picks: initialPicks })
      .expect(201);

    // Update picks (upsert should update, not create a new submission)
    const updatedPicks = hottakes.slice(5, 10).map((h) => h.id);
    const updateResponse = await agent
      .post('/api/submissions?gameDay=0')
      .send({ picks: updatedPicks })
      .expect(201);

    expect(updateResponse.body).toMatchObject({
      nickname: 'UpdateUser',
      picks: updatedPicks,
      gameDay: 0
    });

    // Verify only one submission exists for this user and game day
    const submissions = await prisma.submission.findMany({
      where: { user: { nickname: 'UpdateUser' }, gameDay: 0 }
    });

    expect(submissions).toHaveLength(1);
    expect(submissions[0].picks).toEqual(updatedPicks);
  });

  it('should prevent multiple users from having conflicting submissions', async () => {
    const agent1 = request.agent(app);
    const agent2 = request.agent(app);

    // Register two users
    await agent1
      .post('/api/auth/register')
      .send({ nickname: 'User1', email: 'user1@example.com', password: 'password123' })
      .expect(201);

    await agent2
      .post('/api/auth/register')
      .send({ nickname: 'User2', email: 'user2@example.com', password: 'password123' })
      .expect(201);

    // Create 10 hottakes for game day 0
    const hottakes = await Promise.all(
      Array.from({ length: 10 }).map((_, index) =>
        prisma.hottake.create({ data: { text: `Hottake ${index + 1}`, status: 'OFFEN', gameDay: 0 } })
      )
    );

    const picks = hottakes.slice(0, 5).map((h) => h.id);

    // Both users should be able to submit the same picks for the same game day
    await agent1
      .post('/api/submissions?gameDay=0')
      .send({ picks })
      .expect(201);

    await agent2
      .post('/api/submissions?gameDay=0')
      .send({ picks })
      .expect(201);

    // Verify both submissions exist
    const submissions = await prisma.submission.findMany({
      where: { gameDay: 0 },
      include: { user: true }
    });

    expect(submissions).toHaveLength(2);
    expect(submissions.map((s) => s.user.nickname).sort()).toEqual(['User1', 'User2']);
  });
});
