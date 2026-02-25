import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { authorize } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { z } from 'zod';

const routeManagementRouter = Router();
routeManagementRouter.use(authenticate);

// ─── Validation ──────────────────────────────────────────

const createRouteSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    areas: z.array(z.object({
        name: z.string(),
        lat: z.number(),
        lng: z.number(),
        radius: z.number().positive(),
    })).optional(),
});

const createCSPSchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    routeId: z.string().uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
});

const assignRouteSchema = z.object({
    userId: z.string().uuid(),
    routeId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Route Management ────────────────────────────────────

routeManagementRouter.post(
    '/',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    validate({ body: createRouteSchema }),
    asyncHandler(async (req, res) => {
        const route = await prisma.route.create({ data: req.body });
        sendCreated(res, route, 'Route created successfully');
    })
);

routeManagementRouter.get(
    '/',
    asyncHandler(async (_req, res) => {
        const routes = await prisma.route.findMany({
            where: { isActive: true },
            include: { csps: { where: { isActive: true }, select: { id: true, name: true, code: true } } },
            orderBy: { name: 'asc' },
        });
        sendSuccess(res, routes);
    })
);

routeManagementRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const route = await prisma.route.findUnique({
            where: { id: req.params.id as string },
            include: {
                csps: true,
                assignments: {
                    where: { isActive: true },
                    include: { user: { select: { id: true, fullName: true, role: true } } },
                },
            },
        });
        if (!route) throw new NotFoundError('Route not found');
        sendSuccess(res, route);
    })
);

routeManagementRouter.delete(
    '/:id',
    authorize('SUPER_ADMIN'),
    asyncHandler(async (req, res) => {
        await prisma.route.update({ where: { id: req.params.id as string }, data: { isActive: false } });
        sendNoContent(res);
    })
);

// ─── CSP Management ──────────────────────────────────────

routeManagementRouter.post(
    '/csps',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    validate({ body: createCSPSchema }),
    asyncHandler(async (req, res) => {
        const csp = await prisma.cSP.create({
            data: req.body,
            include: { route: { select: { id: true, name: true } } },
        });
        sendCreated(res, csp, 'CSP created successfully');
    })
);

routeManagementRouter.get(
    '/csps/all',
    asyncHandler(async (_req, res) => {
        const csps = await prisma.cSP.findMany({
            where: { isActive: true },
            include: { route: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' },
        });
        sendSuccess(res, csps);
    })
);

// ─── Route Assignments ───────────────────────────────────

routeManagementRouter.post(
    '/assignments',
    authorize('SUPER_ADMIN', 'SM_ADMIN'),
    validate({ body: assignRouteSchema }),
    asyncHandler(async (req, res) => {
        const assignment = await prisma.routeAssignment.create({
            data: {
                ...req.body,
                startDate: new Date(req.body.startDate),
                endDate: req.body.endDate ? new Date(req.body.endDate) : null,
            },
            include: {
                user: { select: { id: true, fullName: true } },
                route: { select: { id: true, name: true } },
            },
        });
        sendCreated(res, assignment, 'Route assigned successfully');
    })
);

export { routeManagementRouter };
