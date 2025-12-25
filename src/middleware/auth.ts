import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Es wird definiert, was im Token (JWT) gespeichert wird (payload)
export interface UserPayload {
    id: number;
    nickname: string;
    email: string | null;
}

// Hier wird die Request erweitert, damit der payload-Typ (gibt an was im payload erwartet wird (z.B. id, nickname, email)) bekannt ist
export interface AuthRequest extends Request {
    user?: UserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Please define it in the environment.');
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    // Token aus Cookie lesen (gesetzt via httpOnly Cookie)
    const token = req.cookies?.token;

    // Falls kein Token vorhanden ist, 401 zurückgeben
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    // Token verifizieren und Payload auslesen
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (typeof decoded !== 'object' || decoded === null || !('id' in decoded)) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }

        (req as AuthRequest).user = decoded as UserPayload;
        next();
    } catch (err) {
        // Token ungültig oder abgelaufen
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
