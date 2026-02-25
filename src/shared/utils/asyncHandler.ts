import { Request, Response, NextFunction } from 'express';

type AsyncRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<void | Response>;

/**
 * Wraps async route handlers to automatically catch errors
 * and forward them to Express error middleware.
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
