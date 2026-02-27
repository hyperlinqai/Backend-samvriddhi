import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { hasPermission } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { z } from 'zod';

const entityRouter = Router();
entityRouter.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────

const createEntitySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    code: z.string().min(1, 'Code is required'),
});

const updateEntitySchema = z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(1).optional(),
    status: z.boolean().optional(),
});

const listEntitiesSchema = z.object({
    status: z.string().transform((v) => v === 'true').optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Create entity (admin only)
entityRouter.post(
    '/',
    hasPermission('entities.manage'),
    validate({ body: createEntitySchema }),
    asyncHandler(async (req, res) => {
        const entity = await prisma.entity.create({
            data: {
                name: req.body.name,
                code: req.body.code,
            },
        });
        sendCreated(res, entity, 'Entity created successfully');
    })
);

// List all entities
entityRouter.get(
    '/',
    validate({ query: listEntitiesSchema }),
    asyncHandler(async (req, res) => {
        const { status, search, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};
        if (status !== undefined) {
            where.status = status === 'true';
        } else {
            // Default to only showing active (non-deleted) entities
            where.status = true;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.entity.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    code: true,
                    status: true,
                    createdAt: true,
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.entity.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Get entity by ID
entityRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const entity = await prisma.entity.findUnique({
            where: { id: req.params.id as string },
            select: {
                id: true,
                name: true,
                code: true,
                status: true,
                createdAt: true,
                _count: {
                    select: { users: true, roles: true },
                },
            },
        });
        if (!entity) throw new NotFoundError('Entity not found');
        sendSuccess(res, entity);
    })
);

// Update entity (admin only)
entityRouter.patch(
    '/:id',
    hasPermission('entities.manage'),
    validate({ body: updateEntitySchema }),
    asyncHandler(async (req, res) => {
        const entity = await prisma.entity.update({
            where: { id: req.params.id as string },
            data: req.body,
            select: {
                id: true,
                name: true,
                code: true,
                status: true,
                createdAt: true,
            },
        });
        sendSuccess(res, entity, 'Entity updated successfully');
    })
);

// Hard-delete entity (admin only) — physically removes from DB
entityRouter.delete(
    '/:id/hard',
    hasPermission('entities.manage'),
    asyncHandler(async (req, res) => {
        await prisma.entity.delete({
            where: { id: req.params.id as string },
        });
        sendNoContent(res);
    })
);

// Soft-delete entity (admin only) — sets status to false
entityRouter.delete(
    '/:id',
    hasPermission('entities.manage'),
    asyncHandler(async (req, res) => {
        await prisma.entity.update({
            where: { id: req.params.id as string },
            data: { status: false },
        });
        sendNoContent(res);
    })
);

export { entityRouter };
