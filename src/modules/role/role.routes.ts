import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { hasPermission } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../shared/utils/response';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError';
import { z } from 'zod';

const roleRouter = Router();
roleRouter.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────

const createRoleSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    level: z.coerce.number().int().min(0, 'Level must be at least 0'),
    entityId: z.string().uuid('Invalid entity ID').optional(),
    permissions: z.array(z.string().uuid()).optional(),
});

const updateRoleSchema = z.object({
    name: z.string().min(2).optional(),
    level: z.coerce.number().int().min(0).optional(),
    entityId: z.string().uuid().optional().nullable(),
    permissions: z.array(z.string().uuid()).optional(),
});

const listRolesSchema = z.object({
    search: z.string().optional(),
    entityId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Routes ──────────────────────────────────────────────

// Get permissions list (available for matrix)
roleRouter.get(
    '/permissions',
    hasPermission('roles.manage'),
    asyncHandler(async (_req, res) => {
        const permissions = await prisma.permission.findMany({
            orderBy: { name: 'asc' }
        });
        sendSuccess(res, permissions);
    })
);

// Create role (admin only)
roleRouter.post(
    '/',
    hasPermission('roles.manage'),
    validate({ body: createRoleSchema }),
    asyncHandler(async (req, res) => {
        const { name, level, entityId, permissions } = req.body;

        const role = await prisma.$transaction(async (tx) => {
            // Create role record
            const newRole = await tx.roleRecord.create({
                data: {
                    name,
                    level,
                    entityId: entityId || null,
                },
            });

            // Map permissions if provided
            if (permissions && permissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissions.map((permId: string) => ({
                        roleId: newRole.id,
                        permissionId: permId,
                    })),
                });
            }

            return tx.roleRecord.findUnique({
                where: { id: newRole.id },
                include: {
                    entity: { select: { name: true } },
                    rolePermissions: {
                        include: { permission: { select: { name: true } } }
                    }
                }
            });
        });

        sendCreated(res, role, 'Role created successfully');
    })
);

// List all roles
roleRouter.get(
    '/',
    hasPermission('users.read'),
    validate({ query: listRolesSchema }),
    asyncHandler(async (req, res) => {
        const { search, entityId, page, limit } = req.query as any;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const where: any = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (entityId) {
            where.entityId = entityId;
        }

        const [total, roles] = await Promise.all([
            prisma.roleRecord.count({ where }),
            prisma.roleRecord.findMany({
                where,
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { level: 'desc' },
                include: {
                    entity: { select: { name: true } },
                    rolePermissions: true,
                    _count: { select: { users: true, rolePermissions: true } },
                },
            }),
        ]);

        const totalPages = Math.ceil(total / limitNum);
        sendPaginated(res, {
            data: roles as never[],
            meta: { total, page: pageNum, limit: limitNum, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 }
        }, 'Roles retrieved successfully');
    })
);

// Get role by ID
roleRouter.get(
    '/:id',
    hasPermission('users.read'),
    asyncHandler(async (req, res) => {
        const role = await prisma.roleRecord.findUnique({
            where: { id: req.params.id as string },
            include: {
                entity: { select: { name: true } },
                rolePermissions: {
                    include: { permission: true }
                },
                _count: { select: { users: true } }
            },
        });
        if (!role) throw new NotFoundError('Role not found');
        sendSuccess(res, role);
    })
);

// Update role
roleRouter.patch(
    '/:id',
    hasPermission('roles.manage'),
    validate({ body: updateRoleSchema }),
    asyncHandler(async (req, res) => {
        const roleId = req.params.id as string;
        const { name, level, entityId, permissions } = req.body;

        // Check if role exists
        const existingRole = await prisma.roleRecord.findUnique({ where: { id: roleId } });
        if (!existingRole) throw new NotFoundError('Role not found');

        const role = await prisma.$transaction(async (tx) => {
            // Update base details
            const dataToUpdate: any = {};
            if (name !== undefined) dataToUpdate.name = name;
            if (level !== undefined) dataToUpdate.level = level;
            if (entityId !== undefined) dataToUpdate.entityId = entityId;

            if (Object.keys(dataToUpdate).length > 0) {
                await tx.roleRecord.update({
                    where: { id: roleId },
                    data: dataToUpdate,
                });
            }

            // Sync permissions if provided
            if (permissions !== undefined) {
                // Delete old mappings
                await tx.rolePermission.deleteMany({
                    where: { roleId },
                });

                // Add new mappings
                if (permissions.length > 0) {
                    await tx.rolePermission.createMany({
                        data: permissions.map((permId: string) => ({
                            roleId,
                            permissionId: permId,
                        })),
                    });
                }
            }

            return tx.roleRecord.findUnique({
                where: { id: roleId },
                include: {
                    entity: { select: { name: true } },
                    rolePermissions: {
                        include: { permission: { select: { name: true } } }
                    }
                }
            });
        });

        sendSuccess(res, role, 'Role updated successfully');
    })
);

// Delete role
roleRouter.delete(
    '/:id',
    hasPermission('roles.manage'),
    asyncHandler(async (req, res) => {
        const roleId = req.params.id as string;

        // Check if users depend on this role
        const usersCount = await prisma.user.count({
            where: { roleId }
        });

        if (usersCount > 0) {
            throw new BadRequestError(`Cannot delete role: ${usersCount} users are currently assigned to this role.`);
        }

        await prisma.roleRecord.delete({
            where: { id: roleId }
        });

        sendNoContent(res);
    })
);

export default roleRouter;
