import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { authorize } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { z } from 'zod';

const leadRouter = Router();
leadRouter.use(authenticate);

// ─── Validation ──────────────────────────────────────────

const createLeadSchema = z.object({
    name: z.string().min(1),
    phone: z.string().min(10),
    email: z.string().email().optional(),
    address: z.string().optional(),
    assignedToId: z.string().uuid().optional(),
    notes: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    source: z.string().optional(),
});

const updateLeadSchema = z.object({
    name: z.string().min(1).optional(),
    phone: z.string().min(10).optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST']).optional(),
    assignedToId: z.string().uuid().optional(),
    notes: z.string().optional(),
    documentUrls: z.array(z.string().url()).optional(),
});

const listLeadsSchema = z.object({
    status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST']).optional(),
    assignedToId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Create lead
leadRouter.post(
    '/',
    validate({ body: createLeadSchema }),
    asyncHandler(async (req, res) => {
        const lead = await prisma.lead.create({
            data: {
                ...req.body,
                assignedToId: req.body.assignedToId || req.user!.userId,
                createdById: req.user!.userId,
            },
            include: {
                assignedTo: { select: { id: true, fullName: true } },
                createdBy: { select: { id: true, fullName: true } },
            },
        });
        sendCreated(res, lead, 'Lead created successfully');
    })
);

// List leads
leadRouter.get(
    '/',
    validate({ query: listLeadsSchema }),
    asyncHandler(async (req, res) => {
        const { status, assignedToId, search, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};
        if (!['SUPER_ADMIN', 'SM_ADMIN'].includes(req.user!.role)) {
            where.assignedToId = req.user!.userId;
        } else if (assignedToId) {
            where.assignedToId = assignedToId;
        }
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                include: {
                    assignedTo: { select: { id: true, fullName: true } },
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.lead.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Get lead by ID
leadRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const lead = await prisma.lead.findUnique({
            where: { id: req.params.id as string },
            include: {
                assignedTo: { select: { id: true, fullName: true, email: true } },
                createdBy: { select: { id: true, fullName: true } },
            },
        });
        if (!lead) throw new NotFoundError('Lead not found');
        sendSuccess(res, lead);
    })
);

// Update lead
leadRouter.patch(
    '/:id',
    validate({ body: updateLeadSchema }),
    asyncHandler(async (req, res) => {
        const lead = await prisma.lead.update({
            where: { id: req.params.id as string },
            data: req.body,
            include: {
                assignedTo: { select: { id: true, fullName: true } },
            },
        });
        sendSuccess(res, lead, 'Lead updated successfully');
    })
);

// Delete lead (admin only)
leadRouter.delete(
    '/:id',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    asyncHandler(async (req, res) => {
        await prisma.lead.delete({ where: { id: req.params.id as string } });
        sendSuccess(res, null, 'Lead deleted successfully');
    })
);

export { leadRouter };
