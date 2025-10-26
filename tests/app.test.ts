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

    const submissionResponse = await request(app)
      .post('/api/submissions')
      .send({ nickname: 'Lille', picks })
      .expect(201);

    expect(submissionResponse.body).toMatchObject({
      nickname: 'Lille',
      picks,
      score: 0
    });

    const updateStatus = async (id: number, status: 'OFFEN' | 'WAHR' | 'FALSCH') => {
      await request(app)
        .patch(`/api/hottakes/${id}`)
        .set('x-admin-password', 'secret-admin')
        .send({ status })
        .expect(200);
    };

    await updateStatus(hottakeA.id, 'WAHR');
    await updateStatus(hottakeB.id, 'WAHR');
    await updateStatus(hottakeC.id, 'FALSCH');
    await updateStatus(hottakeD.id, 'FALSCH');
    await updateStatus(hottakeE.id, 'FALSCH');

    const byNickname = await request(app).get('/api/submissions/Lille').expect(200);
    expect(byNickname.body.score).toBe(9);

    const byQuery = await request(app).get('/api/submissions?nickname=Lille').expect(200);
    expect(byQuery.body.picks).toEqual(picks);

    const leaderboard = await request(app).get('/api/leaderboard').expect(200);
    expect(Array.isArray(leaderboard.body)).toBe(true);
    expect(leaderboard.body[0]).toMatchObject({ nickname: 'Lille', score: 9 });
  });

  it('requires admin password for creating hottakes and exposes health check', async () => {
    await request(app)
      .post('/api/hottakes')
      .send({ text: 'New bold prediction' })
      .expect(401);

    const created = await request(app)
      .post('/api/hottakes')
      .set('x-admin-password', 'secret-admin')
      .send({ text: 'Fans storm the pitch', status: 'OFFEN' })
      .expect(201);

    expect(created.body).toMatchObject({ text: 'Fans storm the pitch', status: 'OFFEN' });

    const hottakes = await request(app).get('/api/hottakes').expect(200);
    expect(hottakes.body).toHaveLength(1);

    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toEqual({ ok: true });
  });
});
