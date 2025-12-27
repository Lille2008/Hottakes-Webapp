import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

let app: Express;
let prisma: PrismaClient;

const truncateTables = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "submissions", "users", "hottakes", "settings", "admin_events" RESTART IDENTITY CASCADE;'
  );
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
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Hottakes API', () => {
  it('stores submissions and computes leaderboard scores', async () => {
    const agent = request.agent(app);
    const adminAgent = request.agent(app);

    await agent
      .post('/api/auth/register')
      .send({ nickname: 'Lille', email: 'lille@example.com', password: 'password123' })
      .expect(201);

    await adminAgent
      .post('/api/auth/register')
      .send({ nickname: 'lille08', email: 'admin@example.com', password: 'adminpass123' })
      .expect(201);

    const [hottakeA, hottakeB, hottakeC, hottakeD, hottakeE] = await Promise.all([
      prisma.hottake.create({ data: { text: 'Team A wins', status: 'OFFEN' } }),
      prisma.hottake.create({ data: { text: 'Team B scores two goals', status: 'OFFEN' } }),
      prisma.hottake.create({ data: { text: 'Player C gets red card', status: 'OFFEN' } }),
      prisma.hottake.create({ data: { text: 'Match goes to penalties', status: 'OFFEN' } }),
      prisma.hottake.create({ data: { text: 'Coach resigns post match', status: 'OFFEN' } })
    ]);

    await Promise.all(
      Array.from({ length: 5 }).map((_, index) =>
        prisma.hottake.create({
          data: { text: `Zusatz-Hottake ${index + 1}`, status: 'OFFEN' }
        })
      )
    );

    const picks = [hottakeA.id, hottakeB.id, hottakeC.id, hottakeD.id, hottakeE.id];

    const submissionResponse = await agent
      .post('/api/submissions')
      .send({ picks })
      .expect(201);

    expect(submissionResponse.body).toMatchObject({
      nickname: 'Lille',
      picks,
      score: 0
    });

    const updateStatus = async (id: number, status: 'OFFEN' | 'WAHR' | 'FALSCH') => {
      await adminAgent
        .patch(`/api/hottakes/${id}`)
        .send({ status })
        .expect(200);
    };

    await updateStatus(hottakeA.id, 'WAHR');
    await updateStatus(hottakeB.id, 'WAHR');
    await updateStatus(hottakeC.id, 'FALSCH');
    await updateStatus(hottakeD.id, 'FALSCH');
    await updateStatus(hottakeE.id, 'FALSCH');

    const byNickname = await agent.get('/api/submissions/Lille').expect(200);
    expect(byNickname.body.score).toBe(9);

    const byQuery = await agent.get('/api/submissions?nickname=Lille').expect(200);
    expect(byQuery.body.picks).toEqual(picks);

    const leaderboard = await request(app).get('/api/leaderboard').expect(200);
    expect(Array.isArray(leaderboard.body)).toBe(true);
    expect(leaderboard.body[0]).toMatchObject({ nickname: 'Lille', score: 9 });
  });

  it('requires admin password for creating hottakes and exposes health check', async () => {
    const adminAgent = request.agent(app);

    await adminAgent
      .post('/api/auth/register')
      .send({ nickname: 'lille08', email: 'admin@example.com', password: 'adminpass123' })
      .expect(201);

    await request(app)
      .post('/api/hottakes')
      .send({ text: 'New bold prediction' })
      .expect(401);

    const created = await adminAgent
      .post('/api/hottakes')
      .send({ text: 'Fans storm the pitch', status: 'OFFEN' })
      .expect(201);

    expect(created.body).toMatchObject({ text: 'Fans storm the pitch', status: 'OFFEN' });

    const hottakes = await request(app).get('/api/hottakes').expect(200);
    expect(hottakes.body).toHaveLength(1);

    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toEqual({ ok: true });
  });

  it('blocks submissions after lock time is reached', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/auth/register')
      .send({ nickname: 'PlayerOne', email: 'player1@example.com', password: 'password123' })
      .expect(201);

    await prisma.gameDay.create({
      data: {
        description: 'Test lock',
        lockTime: new Date(Date.now() - 60_000),
        status: 'ACTIVE',
        gameDay: 0
      }
    });

    const hottakeIds = await Promise.all(
      Array.from({ length: 5 }).map((_, index) =>
        prisma.hottake.create({ data: { text: `Locked Pick ${index + 1}`, status: 'OFFEN', gameDay: 0 } })
      )
    );

    await agent
      .post('/api/submissions')
      .send({ picks: hottakeIds.map((hot) => hot.id) })
      .expect(403);
  });

  it('handles password reset flow', async () => {
    const agent = request.agent(app);
    const email = 'resetme@example.com';

    await agent
      .post('/api/auth/register')
      .send({ nickname: 'ResetUser', email, password: 'oldpassword123' })
      .expect(201);

    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    const userWithToken = await prisma.user.findUnique({ where: { email } });
    expect(userWithToken?.resetToken).toBeTruthy();

    const token = userWithToken?.resetToken as string;

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'newpassword123' })
      .expect(200);

    await agent
      .post('/api/auth/login')
      .send({ login: email, password: 'newpassword123' })
      .expect(200);
  });
});
