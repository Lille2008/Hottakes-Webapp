import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';

// Validierungsschemata
const registerSchema = z.object({
    nickname: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(6)
});

const loginSchema = z.object({
    login: z.string(), // kann nickname oder email sein
    password: z.string()
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { nickname, email, password } = registerSchema.parse(req.body);

        // Prüfen ob User existiert
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ nickname }, { email }]
            }
        });

        if (existing) {
            return res.status(409).json({ message: 'Nickname or Email already taken' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                nickname,
                email,
                passwordHash
            }
        });

        // Direkt einloggen -> Token generieren
        const payload = { id: newUser.id, nickname: newUser.nickname, email: newUser.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

        // HttpOnly Cookie setzen
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // nur https in production
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Tage
        });

        res.status(201).json({ user: payload });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { login, password } = loginSchema.parse(req.body);

        // SPECIAL ADMIN HANDLING
        if (login === 'lille08') {
            const adminPassword = process.env.ADMIN_PASSWORD;
            if (!adminPassword) {
                return res.status(500).json({ message: 'Server misconfiguration: ADMIN_PASSWORD not set' });
            }

            if (password === adminPassword || password === 'mbangula7') { // Allow both env pass and hardcoded user pass
                // Fake User Object for Admin
                const payload = { id: 999999, nickname: 'lille08', email: null };
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 24 * 60 * 60 * 1000
                });

                return res.json({ user: payload });
            }
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [{ nickname: login }, { email: login }]
            }
        });

        if (!user || !user.passwordHash) {
            // Sicherheits-Best-Practice: Generische Fehlermeldung
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const cleanHash = user.passwordHash.trim();
        const match = await bcrypt.compare(password, cleanHash);

        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = { id: user.id, nickname: user.nickname, email: user.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ user: payload });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    const user = (req as AuthRequest).user;
    res.json({ user });
});

export default router;
