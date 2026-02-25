import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { authorize } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import { z } from 'zod';

const discrepancyRouter = Router();
discrepancyRouter.use(authenticate);

// ─── Validation ──────────────────────────────────────────

const createDiscrepancySchema = z.object({
    type: z.enum(['ATTENDANCE', 'EXPENSE', 'VISIT', 'OTHER']),
    relatedEntityId: z.string().uuid(),
    relatedEntityType: z.string().min(1),
    description: z.string().min(10, 'Description must be at least 10 characters'),
});

const resolveDiscrepancySchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    resolutionNotes: z.string().min(1, 'Resolution notes are required'),
});

const listDiscrepanciesSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    type: z.enum(['ATTENDANCE', 'EXPENSE', 'VISIT', 'OTHER']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Raise discrepancy
discrepancyRouter.post(
    '/',
    validate({ body: createDiscrepancySchema }),
    asyncHandler(async (req, res) => {
        const discrepancy = await prisma.discrepancy.create({
            data: {
                ...req.body,
                raisedById: req.user!.userId,
            },
            include: {
                raisedBy: { select: { id: true, fullName: true } },
            },
        });
        sendCreated(res, discrepancy, 'Discrepancy raised successfully');
    })
);

// List discrepancies
discrepancyRouter.get(
    '/',
    validate({ query: listDiscrepanciesSchema }),
    asyncHandler(async (req, res) => {
        const { status, type, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};
        if (!['SUPER_ADMIN', 'SM_ADMIN'].includes(req.user!.role)) {
            where.raisedById = req.user!.userId;
        }
        if (status) where.status = status;
        if (type) where.type = type;

        const [data, total] = await Promise.all([
            prisma.discrepancy.findMany({
                where,
                include: {
                    raisedBy: { select: { id: true, fullName: true } },
                    resolvedBy: { select: { id: true, fullName: true } },
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.discrepancy.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Resolve discrepancy (admin only)
discrepancyRouter.patch(
    '/:id/resolve',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    validate({ body: resolveDiscrepancySchema }),
    asyncHandler(async (req, res) => {
        const discrepancy = await prisma.discrepancy.findUnique({ where: { id: req.params.id as string } });
        if (!discrepancy) throw new NotFoundError('Discrepancy not found');
        if (discrepancy.raisedById === req.user!.userId) {
            throw new ForbiddenError('Cannot resolve your own discrepancy');
        }

        const updated = await prisma.discrepancy.update({
            where: { id: req.params.id as string },
            data: {
                status: req.body.status,
                resolutionNotes: req.body.resolutionNotes,
                resolvedById: req.user!.userId,
            },
            include: {
                raisedBy: { select: { id: true, fullName: true } },
                resolvedBy: { select: { id: true, fullName: true } },
            },
        });
        sendSuccess(res, updated, `Discrepancy ${req.body.status.toLowerCase()}`);
    })
);

// Get discrepancy by ID
discrepancyRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const discrepancy = await prisma.discrepancy.findUnique({
            where: { id: req.params.id as string },
            include: {
                raisedBy: { select: { id: true, fullName: true, email: true } },
                resolvedBy: { select: { id: true, fullName: true } },
            },
        });
        if (!discrepancy) throw new NotFoundError('Discrepancy not found');
        sendSuccess(res, discrepancy);
    })
);

export { discrepancyRouter };
