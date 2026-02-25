import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID Middleware
 *
 * Injects a unique request ID into every incoming request
 * for tracing / correlation in logs.
 */
export const requestId = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const id = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
};
