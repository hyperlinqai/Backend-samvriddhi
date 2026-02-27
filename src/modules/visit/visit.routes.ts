import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { z } from 'zod';
import { getVisibleUserIds } from '../../shared/utils/downline.util';

const visitRouter = Router();
visitRouter.use(authenticate);

// ─── Validation ──────────────────────────────────────────

const createVisitSchema = z.object({
    attendanceId: z.string().uuid(),
    cspId: z.string().uuid().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
    purpose: z.string().min(1, 'Purpose is required'),
    notes: z.string().optional(),
});

const listVisitsSchema = z.object({
    attendanceId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Create visit log (with geo-tag)
visitRouter.post(
    '/',
    validate({ body: createVisitSchema }),
    asyncHandler(async (req, res) => {
        const visit = await prisma.visit.create({
            data: {
                ...req.body,
                userId: req.user!.userId,
                geoTaggedAt: new Date(),
            },
            include: {
                csp: { select: { id: true, name: true, code: true } },
                attendance: { select: { id: true, date: true } },
            },
        });
        sendCreated(res, visit, 'Visit logged successfully');
    })
);

// List visits
visitRouter.get(
    '/',
    validate({ query: listVisitsSchema }),
    asyncHandler(async (req, res) => {
        const { attendanceId, startDate, endDate, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};
        const visibleIds = await getVisibleUserIds(req.user!.userId, req.user!.roleName);
        if (visibleIds) {
            where.userId = { in: visibleIds };
        }
        if (attendanceId) where.attendanceId = attendanceId;
        if (startDate || endDate) {
            where.geoTaggedAt = {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
            };
        }

        const [data, total] = await Promise.all([
            prisma.visit.findMany({
                where,
                include: {
                    user: { select: { id: true, fullName: true } },
                    csp: { select: { id: true, name: true, code: true } },
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { geoTaggedAt: 'desc' },
            }),
            prisma.visit.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Get visit by ID
visitRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const visit = await prisma.visit.findUnique({
            where: { id: req.params.id as string },
            include: {
                user: { select: { id: true, fullName: true, email: true } },
                csp: true,
                attendance: true,
            },
        });
        if (!visit) throw new NotFoundError('Visit not found');
        sendSuccess(res, visit);
    })
);

export { visitRouter };
