import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/AppError';

/**
 * Role hierarchy: higher index = more privileges.
 * SUPER_ADMIN > SM_ADMIN > RM > ACCOUNTS
 */
const ROLE_HIERARCHY: Record<Role, number> = {
    ACCOUNTS: 1,
    RM: 2,
    SM_ADMIN: 3,
    SUPER_ADMIN: 4,
};

/**
 * RBAC Middleware — restricts access to specific roles.
 *
 * Usage:
 *   router.get('/admin', authenticate, authorize('SUPER_ADMIN', 'SM_ADMIN'), handler);
 */
export const authorize = (...allowedRoles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return next(
                new ForbiddenError(
                    `Role '${userRole}' is not authorized to access this resource`
                )
            );
        }

        next();
    };
};

/**
 * Minimum role middleware — allows access to the given role and above.
 *
 * Usage:
 *   router.get('/reports', authenticate, minRole('SM_ADMIN'), handler);
 */
export const minRole = (minimumRole: Role) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
        const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

        if (userLevel < requiredLevel) {
            return next(
                new ForbiddenError(
                    `Minimum role '${minimumRole}' required. Your role: '${req.user.role}'`
                )
            );
        }

        next();
    };
};

/**
 * Owner-or-admin middleware — allows access if the user is the resource owner
 * OR has one of the admin roles.
 *
 * Usage:
 *   router.get('/profile/:userId', authenticate, ownerOrAdmin('userId'), handler);
 */
export const ownerOrAdmin = (paramKey: string = 'userId') => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        const resourceOwnerId = req.params[paramKey];
        const isOwner = req.user.userId === resourceOwnerId;
        const isAdmin = ['SUPER_ADMIN', 'SM_ADMIN'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            return next(
                new ForbiddenError('You can only access your own resources')
            );
        }

        next();
    };
};
