import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../shared/errors/AppError';

interface ValidationTarget {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
}

/**
 * Zod Validation Middleware
 *
 * Validates request body, params, and/or query against provided Zod schemas.
 * On failure, throws a structured ValidationError with field-level messages.
 *
 * Usage:
 *   router.post('/check-in', validate({ body: checkInSchema }), handler);
 */
export const validate = (schemas: ValidationTarget) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            if (schemas.body) {
                req.body = schemas.body.parse(req.body);
            }

            if (schemas.params) {
                req.params = schemas.params.parse(req.params) as Record<string, string>;
            }

            if (schemas.query) {
                req.query = schemas.query.parse(req.query) as Record<string, string>;
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const fieldErrors: Record<string, string[]> = {};

                for (const issue of error.issues) {
                    const path = issue.path.join('.');
                    const key = path || '_root';

                    if (!fieldErrors[key]) {
                        fieldErrors[key] = [];
                    }
                    fieldErrors[key].push(issue.message);
                }

                next(new ValidationError('Validation failed', fieldErrors));
            } else {
                next(error);
            }
        }
    };
};
