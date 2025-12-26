import { PrismaClient } from '@prisma/client';
import { calculateScore } from '../src/lib/scoring';

const prisma = new PrismaClient();

async function ensureGameDayZero() {
  const existing = await prisma.adminEvent.findUnique({ where: { gameDay: 0 } });
  if (existing) {
    return existing;
  }

  return prisma.adminEvent.create({
    data: {
      gameDay: 0,
      description: 'Spieltag 0',
      activeFlag: false,
      startTime: null,
      lockTime: null,
      endTime: null
    }
  });
}

async function backfillHottakesToZero() {
  const firstTen = await prisma.hottake.findMany({
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: { id: true }
  });

  if (!firstTen.length) return 0;

  const ids = firstTen.map((h) => h.id);
  await prisma.hottake.updateMany({ where: { id: { in: ids } }, data: { gameDay: 0 } });
  return ids.length;
}

async function backfillSubmissions() {
  const hottakesZero = await prisma.hottake.findMany({ where: { gameDay: 0 }, select: { id: true, status: true } });
  const submissions = await prisma.submission.findMany();

  let updated = 0;

  for (const submission of submissions) {
    const score = calculateScore(submission.picks, hottakesZero);
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        gameDay: submission.gameDay ?? 0,
        score
      }
    });
    updated += 1;
  }

  return updated;
}

async function main() {
  try {
    await ensureGameDayZero();
    const updatedHottakes = await backfillHottakesToZero();
    const updatedSubmissions = await backfillSubmissions();
    console.log(`Backfill fertig: ${updatedHottakes} Hottakes auf Spieltag 0 gesetzt, ${updatedSubmissions} Submissions aktualisiert.`);
  } catch (error) {
    console.error('Backfill fehlgeschlagen:', error);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
