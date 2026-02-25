import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { JwtPayload } from '../../shared/types';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * JWT Authentication Middleware
 *
 * Extracts Bearer token from Authorization header,
 * verifies it against JWT_SECRET, and attaches the decoded
 * payload to `req.user`.
 */
export const authenticate = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('Access token is missing or malformed');
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            throw new UnauthorizedError('Access token is missing');
        }

        const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            next(new UnauthorizedError('Token has expired'));
        } else if (error instanceof jwt.JsonWebTokenError) {
            next(new UnauthorizedError('Invalid token'));
        } else {
            next(error);
        }
    }
};

/**
 * Optional authentication — does not fail if token is absent,
 * but still parses it if present.
 */
export const optionalAuth = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };

        next();
    } catch {
        // Token invalid but auth is optional — continue without user
        next();
    }
};
