import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../../shared/errors/AppError';
import { logger } from '../logger';
import { config } from '../../config';

/**
 * Global Error Handler Middleware
 *
 * Catches all errors, logs them, and returns a standardized JSON response.
 * Differentiates between operational errors (expected) and programmer errors.
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Default to 500
    let statusCode = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let errors: Record<string, string[]> | undefined;
    let isOperational = false;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        code = err.code;
        isOperational = err.isOperational;

        if (err instanceof ValidationError) {
            errors = err.errors;
        }
    }

    // Log the error
    const logMeta = {
        statusCode,
        code,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId,
        userAgent: req.get('user-agent'),
    };

    if (isOperational) {
        logger.warn(`Operational error: ${message}`, logMeta);
    } else {
        logger.error(`Unexpected error: ${err.message}`, {
            ...logMeta,
            stack: err.stack,
        });
    }

    // Build response
    const response: Record<string, unknown> = {
        success: false,
        message: isOperational || config.NODE_ENV === 'development'
            ? message
            : 'Internal server error',
        code,
    };

    if (errors) {
        response.errors = errors;
    }

    // Include stack trace in development
    if (config.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

/**
 * 404 Handler — catches all unmatched routes.
 */
export const notFoundHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const error = new AppError(
        `Route ${req.method} ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
};
