import { Router } from 'express';
import { z } from 'zod'; // Eine Library mit der man überprüft, ob die Eingaben passend sind
import bcrypt from 'bcrypt'; // Hashed Passwörter (aus einem gehashten Wert kann man nicht zurückrechnen) (Beim Login wird erneut das Paswort gehasht und beide Werte werden verglichen)
import jwt from 'jsonwebtoken'; // JSON Web Token (Signierter (verschlüsselter) Token, der im Cookie gespeichert wird / der Inhalt des Cookies)
import prisma from '../lib/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Please define it in the environment.');
}

function signUserToken(payload: { id: number; nickname: string; email: string | null }) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Der Token ist 7 Tage gültig
}

// Gibt an, wie die Eingaben für Registrierung aussehen müssen
const registerSchema = z.object({
    nickname: z.string().min(3).max(20), // Nickname: 3-20 Zeichen
    email: z.string().email(), // E-Mail muss dem Format einer E-Mail entsprechen
    password: z.string().min(6) // Passwort mindestens 6 Zeichen
});

const loginSchema = z.object({
    login: z.string(), // Kann nickname oder email sein
    password: z.string() // Passwort wird gehasht und verglichen
});

// wird aufgerufen, wenn man auf registrieren klickt
router.post('/register', async (req, res, next) => {
    try {
        const { nickname, email, password } = registerSchema.parse(req.body); // eingegebene Daten werden gelesen

        // Prüfen ob es den User bereits gibt
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ nickname }, { email }]
            }
        });

        if (existing) {
            return res.status(409).json({ message: 'Nickname or Email already taken' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Neuen User anlegen
        const newUser = await prisma.user.create({
            data: {
                nickname,
                email,
                passwordHash
            }
        });

        const payload = { id: newUser.id, nickname: newUser.nickname, email: newUser.email };
        const token = signUserToken(payload);

        // HttpOnly Cookie setzen (dadurch kann der Token nicht mit JavaScript im Browser ausgelesen werden)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // nur https mit node_env = production
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // = 7 Tage
        });

        res.status(201).json({ user: payload });
    } catch (error) {
        next(error);
    }
});

// Wenn der User auf einloggen klickt
router.post('/login', async (req, res, next) => {
    try {
        const { login, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findFirst({
            where: {
                OR: [{ nickname: login }, { email: login }]
            }
        });

        if (!user || !user.passwordHash) {
            // Fehlermeldung (401), wenn es den User nicht gibt oder kein Passwort gesetzt ist
            return res.status(401).json({ message: 'User nicht gefunden oder kein Passwort gesetzt' });
        }

        const cleanHash = user.passwordHash.trim();
        const match = await bcrypt.compare(password, cleanHash); // Passwort vergleichen

        if (!match) {
            return res.status(401).json({ message: 'Falsches Passwort' }); // Fehlermeldung, wenn Passwort nicht stimmt
        }

        const payload = { id: user.id, nickname: user.nickname, email: user.email };
        const token = signUserToken(payload); // Token wird erstellt, wodurch sich der User in Zukunft ohne Login identifizieren kann

        res.cookie('token', token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // = 7 Tage
        });

        res.json({ user: payload });
    } catch (error) {
        next(error);
    }
});

// Wenn der User auf Logout klickt
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' // lax reicht aus, weil die gesamte Logik auf der gleichen Domain stattfindet
    });
    res.json({ message: 'Du bist ausgeloggt' });
});

// Ruft die Middleware requireAuth auf, um den User zu authentifizieren
router.get('/me', requireAuth, (req, res) => {
    const user = (req as AuthRequest).user;
    res.json({ user });
});

export default router;
