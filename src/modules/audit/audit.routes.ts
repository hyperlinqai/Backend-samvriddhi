import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { hasPermission } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.use(hasPermission('audit.read'));

// ─── Validation ──────────────────────────────────────────

const listAuditLogsSchema = z.object({
    userId: z.string().uuid().optional(),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
    action: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
});

// ─── Routes ──────────────────────────────────────────────

// List audit logs (admin only)
auditRouter.get(
    '/',
    validate({ query: listAuditLogsSchema }),
    asyncHandler(async (req, res) => {
        const { userId, entityType, entityId, action, startDate, endDate, page, limit } =
            req.query as Record<string, string>;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 50;

        const where: Record<string, unknown> = {};
        if (userId) where.userId = userId;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (action) where.action = action;
        if (startDate || endDate) {
            where.timestamp = {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
            };
        }

        const [data, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, fullName: true, email: true, roleRecord: { select: { name: true } } } },
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { timestamp: 'desc' },
            }),
            prisma.auditLog.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: data as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
        });
    })
);

// Get audit trail for a specific entity
auditRouter.get(
    '/entity/:entityType/:entityId',
    asyncHandler(async (req, res) => {
        const logs = await prisma.auditLog.findMany({
            where: {
                entityType: req.params.entityType as string,
                entityId: req.params.entityId as string,
            },
            include: {
                user: { select: { id: true, fullName: true, roleRecord: { select: { name: true } } } },
            },
            orderBy: { timestamp: 'desc' },
        });
        sendSuccess(res, logs, 'Audit trail fetched');
    })
);

export { auditRouter };

// ─── Audit Logger Utility ───────────────────────────────
// Use this in services to log actions

export async function createAuditLog(params: {
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    prevData?: Prisma.InputJsonValue;
    newData?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await prisma.auditLog.create({
        data: {
            userId: params.userId,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            prevData: params.prevData ?? undefined,
            newData: params.newData ?? undefined,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
        },
    });
}
