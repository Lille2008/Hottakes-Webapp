import { NextFunction, Request, Response } from 'express';
import { GAME_DAY_STATUS, getGameDayByNumber, resolveGameDayParam } from '../lib/gameDay';

export async function checkGameDayLock(req: Request, res: Response, next: NextFunction) {
  try {
    const gameDay = await resolveGameDayParam(req.query.gameDay);
    const event = await getGameDayByNumber(gameDay);

    if (!event.lockTime) {
      return next();
    }

    const now = new Date();

    if (event.status !== GAME_DAY_STATUS.ACTIVE) {
      return res.status(403).json({ message: 'Picks sind gesperrt. Der Spieltag ist abgeschlossen.' });
    }

    if (now >= event.lockTime) {
      return res.status(403).json({
        message: 'Picks sind gesperrt. Der Spieltag hat begonnen.',
        lockTime: event.lockTime
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
