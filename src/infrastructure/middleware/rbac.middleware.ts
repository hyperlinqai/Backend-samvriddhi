import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/AppError';

/**
 * RBAC Middleware — restricts access to specific role names.
 *
 * Usage:
 *   router.get('/admin', authenticate, authorize('SUPER_ADMIN', 'NATIONAL_HEAD'), handler);
 */
export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        const userRole = req.user.roleName;

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
 * Minimum role level middleware — allows access to the given level and above.
 *
 * Usage:
 *   router.get('/reports', authenticate, minRoleLevel(30), handler);
 */
export const minRoleLevel = (minimumLevel: number) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        const userLevel = req.user.roleLevel ?? 0;

        if (userLevel < minimumLevel) {
            return next(
                new ForbiddenError(
                    `Minimum role level ${minimumLevel} required. Your level: ${userLevel}`
                )
            );
        }

        next();
    };
};

/**
 * Permission-based middleware — checks if the user's JWT contains
 * the required permission string.
 *
 * Usage:
 *   router.get('/users', authenticate, hasPermission('users.read'), handler);
 */
export const hasPermission = (...requiredPermissions: string[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        // Super Admin bypasses all permission checks
        if (req.user.roleName === 'SUPER_ADMIN') {
            return next();
        }

        const userPermissions = req.user.permissions ?? [];
        const hasAll = requiredPermissions.every((p) =>
            userPermissions.includes(p)
        );

        if (!hasAll) {
            return next(
                new ForbiddenError(
                    `Missing required permissions: ${requiredPermissions.join(', ')}`
                )
            );
        }

        next();
    };
};

/**
 * Owner-or-admin middleware — allows access if the user is the resource owner
 * OR has a role level >= 30 (State Head and above).
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
        const isAdmin = (req.user.roleLevel ?? 0) >= 30; // State Head and above

        if (!isOwner && !isAdmin) {
            return next(
                new ForbiddenError('You can only access your own resources')
            );
        }

        next();
    };
};
