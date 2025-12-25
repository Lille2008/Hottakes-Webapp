import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Es wird definiert, was im Token (JWT) gespeichert wird (payload)
export interface UserPayload {
    id: number;
    nickname: string;
    email: string | null;
}

// Erweitert das Request-Objekt (muss via Type-Assertion oder Declaration Merging genutzt werden)
export interface AuthRequest extends Request {
    user?: UserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET;

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
        const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
        (req as AuthRequest).user = payload;
        next();
    } catch (err) {
        // Token ungültig oder abgelaufen
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
