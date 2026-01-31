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

  // Daily status sync (05:00): if a game day is close enough (lockTime within 5 days),
  // we promote it from PENDING -> ACTIVE.
  // Why: the app treats such days as "current" already (see findCurrentGameDayNumber),
  // so persisting it in DB keeps API/UI behavior consistent.
  cron.schedule('0 5 * * *', async () => {
    try {
      const now = new Date();
      const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const result = await prisma.gameDay.updateMany({
        where: {
          status: GAME_DAY_STATUS.PENDING,
          lockTime: {
            not: null,
            lte: fiveDaysFromNow
          }
        },
        data: { status: GAME_DAY_STATUS.ACTIVE }
      });

      if (result.count > 0) {
        console.log(`[scheduler] promoted ${result.count} game day(s) from PENDING to ACTIVE`);
      }
    } catch (error) {
      console.error('[scheduler] game day status job failed', error);
    }
  });

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
