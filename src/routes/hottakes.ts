import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';
import { optionalAuth, type AuthRequest } from '../middleware/auth';

const STATUS_VALUES = ['OFFEN', 'WAHR', 'FALSCH'] as const;

const createHottakeSchema = z.object({
  text: z.string().min(3),
  status: z.enum(STATUS_VALUES).optional()
});

const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES)
});

const router = Router();

const ADMIN_NICKNAME = process.env.ADMIN_NICKNAME || 'lille08';

router.get('/', async (_req, res, next) => {
  try {
    const hottakes = await prisma.hottake.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json(hottakes);
  } catch (error) {
    next(error);
  }
});

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

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (isAdminFromHeader(req)) {
    return next();
  }

  if (isAdminUser(req)) {
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized' });
}

router.use(optionalAuth);

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const payload = createHottakeSchema.parse(req.body);
    const hottake = await prisma.hottake.create({
      data: {
        text: payload.text,
        status: payload.status ?? 'OFFEN'
      }
    });

    res.status(201).json(hottake);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid hottake id' });
    }

    const payload = updateStatusSchema.parse(req.body);

    const hottake = await prisma.hottake.update({
      where: { id },
      data: { status: payload.status }
    });

    res.json(hottake);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Hottake not found' });
    }

    next(error);
  }
});

export default router;
