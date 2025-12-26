import { NextFunction, Response } from 'express';
import { AuthRequest, optionalAuth } from './auth';

const ADMIN_NICKNAME = process.env.ADMIN_NICKNAME || 'lille08';

function isAdminFromHeader(req: { header: (name: string) => string | undefined }) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return false;
  }

  const providedPassword = req.header('x-admin-password');
  return providedPassword === adminPassword;
}

function isAdminUser(req: AuthRequest) {
  return req.user?.nickname === ADMIN_NICKNAME;
}

export function isAdmin(req: AuthRequest) {
  return isAdminFromHeader(req) || isAdminUser(req);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (isAdmin(req)) {
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized' });
}
