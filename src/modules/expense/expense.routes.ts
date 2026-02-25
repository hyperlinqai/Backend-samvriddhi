import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { authorize } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import { haversineDistance } from '../../shared/utils/geo';
import { z } from 'zod';

const expenseRouter = Router();
expenseRouter.use(authenticate);

// ─── Validation ──────────────────────────────────────────

const createExpenseSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().min(1),
    amount: z.number().positive(),
    description: z.string().optional(),
    startLat: z.number().min(-90).max(90).optional(),
    startLng: z.number().min(-180).max(180).optional(),
    endLat: z.number().min(-90).max(90).optional(),
    endLng: z.number().min(-180).max(180).optional(),
    manualKm: z.number().positive().optional(),
});

const updateExpenseStatusSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    approvalNote: z.string().optional(),
});

const listExpensesSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    userId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Create expense (with auto-KM calculation)
expenseRouter.post(
    '/',
    validate({ body: createExpenseSchema }),
    asyncHandler(async (req, res) => {
        let autoKm: number | undefined;

        // Calculate auto KM from GPS coords if provided
        if (req.body.startLat && req.body.startLng && req.body.endLat && req.body.endLng) {
            autoKm = haversineDistance(
                { lat: req.body.startLat, lng: req.body.startLng },
                { lat: req.body.endLat, lng: req.body.endLng }
            );
            autoKm = Math.round(autoKm * 100) / 100;
        }

        const expense = await prisma.expense.create({
            data: {
                ...req.body,
                date: new Date(req.body.date),
                userId: req.user!.userId,
                autoKm,
                status: 'PENDING',
            },
        });
        sendCreated(res, expense, 'Expense submitted successfully');
    })
);

// List expenses
expenseRouter.get(
    '/',
    validate({ query: listExpensesSchema }),
    asyncHandler(async (req, res) => {
        const { status, startDate, endDate, userId, page, limit } = req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: Record<string, unknown> = {};
        if (!['SUPER_ADMIN', 'SM_ADMIN', 'ACCOUNTS'].includes(req.user!.role)) {
            where.userId = req.user!.userId;
        } else if (userId) {
            where.userId = userId;
        }
        if (status) where.status = status;
        if (startDate || endDate) {
            where.date = {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
            };
        }

        const [data, total] = await Promise.all([
            prisma.expense.findMany({
                where,
                include: {
                    user: { select: { id: true, fullName: true } },
                    approvedBy: { select: { id: true, fullName: true } },
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.expense.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Approve/Reject expense (admin/accounts only)
expenseRouter.patch(
    '/:id/status',
    authorize('SUPER_ADMIN', 'SM_ADMIN', 'ACCOUNTS'),
    validate({ body: updateExpenseStatusSchema }),
    asyncHandler(async (req, res) => {
        const expense = await prisma.expense.findUnique({ where: { id: req.params.id as string } });
        if (!expense) throw new NotFoundError('Expense not found');
        if (expense.userId === req.user!.userId) {
            throw new ForbiddenError('Cannot approve your own expense');
        }

        const updated = await prisma.expense.update({
            where: { id: req.params.id as string },
            data: {
                status: req.body.status,
                approvedById: req.user!.userId,
                approvalNote: req.body.approvalNote,
            },
        });
        sendSuccess(res, updated, `Expense ${req.body.status.toLowerCase()}`);
    })
);

// Get expense by ID
expenseRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const expense = await prisma.expense.findUnique({
            where: { id: req.params.id as string },
            include: {
                user: { select: { id: true, fullName: true, email: true } },
                approvedBy: { select: { id: true, fullName: true } },
            },
        });
        if (!expense) throw new NotFoundError('Expense not found');
        sendSuccess(res, expense);
    })
);

export { expenseRouter };
