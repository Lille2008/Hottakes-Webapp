import { NextFunction, Request, Response } from 'express';
import prisma from '../lib/db';

export async function checkGameDayLock(req: Request, res: Response, next: NextFunction) {
  try {
    const activeGameDay = await prisma.adminEvent.findFirst({
      where: {
        activeFlag: true,
        lockTime: { not: null }
      },
      orderBy: { lockTime: 'desc' }
    });

    if (!activeGameDay || !activeGameDay.lockTime) {
      return next();
    }

    const now = new Date();

    if (now >= activeGameDay.lockTime) {
      return res.status(403).json({
        message: 'Picks sind gesperrt. Der Spieltag hat begonnen.',
        lockTime: activeGameDay.lockTime
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
