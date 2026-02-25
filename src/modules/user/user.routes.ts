import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { authorize, ownerOrAdmin } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendPaginated, sendNoContent } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { z } from 'zod';

const userRouter = Router();
userRouter.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────

const updateUserSchema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    role: z.enum(['SUPER_ADMIN', 'SM_ADMIN', 'RM', 'ACCOUNTS']).optional(),
    isActive: z.boolean().optional(),
    managerId: z.string().uuid().nullable().optional(),
});

const listUsersSchema = z.object({
    role: z.enum(['SUPER_ADMIN', 'SM_ADMIN', 'RM', 'ACCOUNTS']).optional(),
    isActive: z.string().transform((v) => v === 'true').optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// List all users (admin only)
userRouter.get(
    '/',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    validate({ query: listUsersSchema }),
    asyncHandler(async (req, res) => {
        const { role, isActive, search, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};
        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive === 'true';
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, email: true, phone: true, fullName: true,
                    role: true, isActive: true, avatarUrl: true, managerId: true,
                    createdAt: true, updatedAt: true,
                    manager: { select: { id: true, fullName: true } },
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Get user by ID
userRouter.get(
    '/:userId',
    ownerOrAdmin('userId'),
    asyncHandler(async (req, res) => {
        const user = await prisma.user.findUnique({
            where: { id: req.params.userId as string },
            select: {
                id: true, email: true, phone: true, fullName: true,
                role: true, isActive: true, avatarUrl: true, managerId: true,
                createdAt: true, updatedAt: true,
                manager: { select: { id: true, fullName: true } },
                subordinates: { select: { id: true, fullName: true, role: true } },
            },
        });
        if (!user) throw new NotFoundError('User not found');
        sendSuccess(res, user);
    })
);

// Update user (admin only, except own profile)
userRouter.patch(
    '/:userId',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    validate({ body: updateUserSchema }),
    asyncHandler(async (req, res) => {
        const user = await prisma.user.update({
            where: { id: req.params.userId as string },
            data: req.body,
            select: {
                id: true, email: true, phone: true, fullName: true,
                role: true, isActive: true, avatarUrl: true, managerId: true,
            },
        });
        sendSuccess(res, user, 'User updated successfully');
    })
);

// Deactivate user (admin only)
userRouter.delete(
    '/:userId',
    authorize('SUPER_ADMIN'),
    asyncHandler(async (req, res) => {
        await prisma.user.update({
            where: { id: req.params.userId as string },
            data: { isActive: false },
        });
        sendNoContent(res);
    })
);

export { userRouter };
