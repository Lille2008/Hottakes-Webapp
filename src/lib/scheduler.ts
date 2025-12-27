import cron from 'node-cron';
import prisma from './db';
import { GAME_DAY_STATUS } from './gameDay';
import { sendReminderEmail } from './email';

let started = false;

export function startReminderScheduler() {
  if (started || process.env.NODE_ENV === 'test') {
    return;
  }

  started = true;

  cron.schedule('0 8 * * *', async () => {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const upcomingGameDays = await prisma.gameDay.findMany({
        where: {
          status: GAME_DAY_STATUS.ACTIVE,
          lockTime: {
            gte: now,
            lte: tomorrow
          }
        }
      });

      if (!upcomingGameDays.length) {
        return;
      }

      const usersWithSubmissions = await prisma.submission.findMany({
        select: { userId: true }
      });

      const submittedUserIds = new Set(usersWithSubmissions.map((entry) => entry.userId));

      const usersWithoutSubmissions = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(submittedUserIds) },
          email: { not: null }
        }
      });

      const sendPromises = [] as Promise<unknown>[];

      for (const user of usersWithoutSubmissions) {
        for (const gameDay of upcomingGameDays) {
          sendPromises.push(sendReminderEmail(user.email as string, gameDay));
        }
      }

      await Promise.all(sendPromises);
    } catch (error) {
      console.error('[scheduler] reminder job failed', error);
    }
  });
}
