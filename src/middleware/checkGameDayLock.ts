import { NextFunction, Request, Response } from 'express';
import { GAME_DAY_STATUS, getGameDayByNumber, resolveGameDayParam } from '../lib/gameDay';

export async function checkGameDayLock(req: Request, res: Response, next: NextFunction) {
  try {
    const gameDay = await resolveGameDayParam(req.query.gameDay);
    const event = await getGameDayByNumber(gameDay);

    const now = new Date();

    if (event.status !== GAME_DAY_STATUS.ACTIVE && event.status !== GAME_DAY_STATUS.PENDING) { 
      return res.status(403).json({ message: 'Picks sind gesperrt. Der Spieltag ist abgeschlossen.' }); 
    }

    // If there is no lock time, picks are allowed (for PENDING/ACTIVE only).
    if (!event.lockTime) {
      return next();
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
