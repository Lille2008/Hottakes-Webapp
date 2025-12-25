// Routen für Verwaltung und Auflistung von Hottakes.
// POST/PATCH sind durch ein Admin-Passwort (HTTP-Header x-admin-password) geschützt.
import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/db';

const STATUS_VALUES = ['OFFEN', 'WAHR', 'FALSCH'] as const;

// Eingabevalidierung: neuen Hottake anlegen
const createHottakeSchema = z.object({
  text: z.string().min(3),
  status: z.enum(STATUS_VALUES).optional()
});

// Eingabevalidierung: Status-Update für bestehenden Hottake
const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES)
});

const router = Router();

// Listet alle Hottakes (älteste zuerst) – öffentlich erreichbar
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

function isAdminRequest(req: { header: (name: string) => string | undefined }) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is not set. Please define it in the environment.');
  }

  const providedPassword = req.header('x-admin-password');
  return providedPassword === adminPassword;
}

// Anlage eines Hottakes (Admin)
router.post('/', async (req, res, next) => {
  try {
    const isAuthorized = isAdminRequest(req);

    if (!isAuthorized) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

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

// Status eines Hottakes ändern (Admin)
router.patch('/:id', async (req, res, next) => {
  try {
    const isAuthorized = isAdminRequest(req);

    if (!isAuthorized) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

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
