import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Typ-Erweiterung für Express Request könnte hier oder global stehen.
// Fürs Erste definieren wir ein Interface für den Payload.
export interface UserPayload {
    id: number;
    nickname: string;
    email: string | null;
}

// Erweitert das Request-Objekt (muss via Type-Assertion oder Declaration Merging genutzt werden)
export interface AuthRequest extends Request {
    user?: UserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    // Token aus Cookie 'token' lesen (gesetzt via httpOnly Cookie)
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
        (req as AuthRequest).user = payload;
        next();
    } catch (err) {
        // Token ungültig oder abgelaufen
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

// Optional: Middleware die User lädt aber nicht blockiert (für "soft" auth)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.token;
    if (token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
            (req as AuthRequest).user = payload;
        } catch {
            // Ignorieren
        }
    }
    next();
}
