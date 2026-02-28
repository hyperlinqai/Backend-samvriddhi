import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { hasPermission, ownerOrAdmin } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ConflictError } from '../../shared/errors/AppError';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { config } from '../../config';
import { getVisibleUserIds } from '../../shared/utils/downline.util';

const userRouter = Router();
userRouter.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────

const createUserSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    entityId: z.string().uuid().nullable().optional(),
    roleId: z.string().uuid().nullable().optional(),
    reportingTo: z.string().uuid().nullable().optional(),
});

const updateUserSchema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    entityId: z.string().uuid().nullable().optional(),
    roleId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    reportingTo: z.string().uuid().nullable().optional(),
});

const listUsersSchema = z.object({
    roleName: z.string().optional(),
    entityId: z.string().uuid().optional(),
    isActive: z.string().transform((v) => v === 'true').optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Create user (requires users.create permission)
userRouter.post(
    '/',
    hasPermission('users.create'),
    validate({ body: createUserSchema }),
    asyncHandler(async (req, res) => {
        const { fullName, email, phone, password, entityId, roleId, reportingTo } = req.body;

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] },
        });

        if (existingUser) {
            throw new ConflictError(
                existingUser.email === email
                    ? 'Email already registered'
                    : 'Phone number already registered'
            );
        }

        const passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);

        const user = await prisma.user.create({
            data: { email, phone, passwordHash, fullName, entityId, roleId, reportingTo },
            select: {
                id: true, email: true, phone: true, fullName: true,
                isActive: true, avatarUrl: true, reportingTo: true,
                createdAt: true, updatedAt: true,
                entity: { select: { id: true, name: true, code: true } },
                roleRecord: { select: { id: true, name: true, level: true } },
                reportingToUser: { select: { id: true, fullName: true } },
            },
        });

        sendCreated(res, user, 'User created successfully');
    })
);

// List users (downline-scoped, requires users.read)
userRouter.get(
    '/',
    hasPermission('users.read'),
    validate({ query: listUsersSchema }),
    asyncHandler(async (req, res) => {
        const { roleName, entityId, isActive, search, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};

        // Downline scoping
        const visibleIds = await getVisibleUserIds(req.user!.userId, req.user!.roleName);
        if (visibleIds) {
            where.id = { in: visibleIds };
        }

        if (roleName) where.roleRecord = { name: roleName };
        if (entityId) where.entityId = entityId;
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        } else {
            where.isActive = true; // Default to showing only active users
        }
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
                    isActive: true, avatarUrl: true, reportingTo: true,
                    createdAt: true, updatedAt: true,
                    entity: { select: { id: true, name: true, code: true } },
                    roleRecord: { select: { id: true, name: true, level: true } },
                    reportingToUser: { select: { id: true, fullName: true } },
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
                isActive: true, avatarUrl: true, reportingTo: true,
                createdAt: true, updatedAt: true,
                entity: { select: { id: true, name: true, code: true } },
                roleRecord: { select: { id: true, name: true, level: true } },
                reportingToUser: { select: { id: true, fullName: true } },
                subordinates: { select: { id: true, fullName: true } },
            },
        });
        if (!user) throw new NotFoundError('User not found');
        sendSuccess(res, user);
    })
);

// Update user (requires users.update)
userRouter.patch(
    '/:userId',
    hasPermission('users.update'),
    validate({ body: updateUserSchema }),
    asyncHandler(async (req, res) => {
        const user = await prisma.user.update({
            where: { id: req.params.userId as string },
            data: req.body,
            select: {
                id: true, email: true, phone: true, fullName: true,
                isActive: true, avatarUrl: true, reportingTo: true,
                entity: { select: { id: true, name: true, code: true } },
                roleRecord: { select: { id: true, name: true, level: true } },
            },
        });
        sendSuccess(res, user, 'User updated successfully');
    })
);

// Hard delete user (requires users.delete)
userRouter.delete(
    '/:userId/hard',
    hasPermission('users.delete'),
    asyncHandler(async (req, res) => {
        await prisma.user.delete({
            where: { id: req.params.userId as string },
        });
        sendNoContent(res);
    })
);

// Deactivate user (requires users.delete)
userRouter.delete(
    '/:userId',
    hasPermission('users.delete'),
    asyncHandler(async (req, res) => {
        await prisma.user.update({
            where: { id: req.params.userId as string },
            data: { isActive: false },
        });
        sendNoContent(res);
    })
);

export { userRouter };
