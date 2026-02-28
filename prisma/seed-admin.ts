import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Permission Definitions ────────────────────────────────
const ALL_PERMISSIONS = [
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
    'entities.manage',
    'roles.manage',
    'attendance.read',
    'attendance.write',
    'visits.read',
    'visits.write',
    'leads.read',
    'leads.write',
    'expenses.read',
    'expenses.write',
    'expenses.approve',
    'discrepancies.read',
    'discrepancies.write',
    'discrepancies.resolve',
    'routes.manage',
    'audit.read',
    'reports.read',
];

// ─── Role Definitions ──────────────────────────────────────
const ROLE_DEFINITIONS = [
    {
        name: 'SUPER_ADMIN',
        level: 100,
        // Super Admin bypasses permission checks, but we assign all for completeness
        permissions: ALL_PERMISSIONS,
    },
    {
        name: 'SM_ADMIN',
        level: 50,
        permissions: [
            'users.create', 'users.read', 'users.update', 'users.delete',
            'attendance.read', 'visits.read',
            'leads.read', 'leads.write',
            'expenses.read', 'expenses.approve', 'expenses.write',
            'discrepancies.read', 'discrepancies.write', 'discrepancies.resolve',
            'routes.manage',
            'audit.read', 'reports.read',
        ],
    },
    {
        name: 'RM',
        level: 40,
        permissions: [
            'attendance.read', 'attendance.write',
            'visits.read', 'visits.write',
            'leads.read', 'leads.write',
            'expenses.read', 'expenses.write',
            'discrepancies.read', 'discrepancies.write',
        ],
    },
    {
        name: 'ACCOUNTS',
        level: 30,
        permissions: [
            'users.read',
            'attendance.read',
            'reports.read',
        ],
    },
    {
        name: 'FIELD_USER',
        level: 10,
        permissions: [
            'attendance.read', 'attendance.write',
            'visits.read', 'visits.write',
            'leads.read', 'leads.write',
            'expenses.read', 'expenses.write',
            'discrepancies.read', 'discrepancies.write',
        ],
    },
];

async function main() {
    console.log('🚀 Starting seed process...\n');

    // ─── 1. Create Default Entity ──────────────────────────
    let entity = await prisma.entity.findFirst({ where: { code: 'DEFAULT' } });

    if (!entity) {
        entity = await prisma.entity.create({
            data: { name: 'Default Entity', code: 'DEFAULT', status: true },
        });
        console.log('✅ Default entity created:', entity.name);
    } else {
        console.log('ℹ️  Default entity already exists:', entity.name);
    }

    // ─── 2. Seed Permissions ───────────────────────────────
    console.log('\n📋 Seeding permissions...');
    const permissionMap: Record<string, string> = {};

    for (const permName of ALL_PERMISSIONS) {
        let perm = await prisma.permission.findUnique({ where: { name: permName } });
        if (!perm) {
            perm = await prisma.permission.create({ data: { name: permName } });
            console.log(`   ✅ Created permission: ${permName}`);
        }
        permissionMap[permName] = perm.id;
    }

    // ─── 3. Seed Roles & Role-Permission Mappings ──────────
    console.log('\n👤 Seeding roles...');
    const roleMap: Record<string, string> = {};

    for (const roleDef of ROLE_DEFINITIONS) {
        let role = await prisma.roleRecord.findFirst({
            where: { name: roleDef.name, entityId: null },
        });

        if (!role) {
            role = await prisma.roleRecord.create({
                data: {
                    name: roleDef.name,
                    level: roleDef.level,
                    entityId: null, // Global roles
                },
            });
            console.log(`   ✅ Created role: ${roleDef.name} (level ${roleDef.level})`);
        } else {
            // Update level if it changed
            if (role.level !== roleDef.level) {
                await prisma.roleRecord.update({
                    where: { id: role.id },
                    data: { level: roleDef.level },
                });
                console.log(`   🔄 Updated role level: ${roleDef.name} → ${roleDef.level}`);
            } else {
                console.log(`   ℹ️  Role already exists: ${roleDef.name}`);
            }
        }

        roleMap[roleDef.name] = role.id;

        // Sync permissions for this role
        const existingPerms = await prisma.rolePermission.findMany({
            where: { roleId: role.id },
        });

        const existingPermIds = new Set(existingPerms.map((rp) => rp.permissionId));
        const desiredPermIds = roleDef.permissions.map((p) => permissionMap[p]);

        // Add missing permissions
        for (const permId of desiredPermIds) {
            if (!existingPermIds.has(permId)) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permId },
                });
            }
        }
    }

    // ─── 4. Create Super Admin User ────────────────────────
    console.log('\n🔐 Creating super admin user...');
    const email = 'superadmin@samvirddhi.com';
    const phone = '9999999999';

    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
        console.log('ℹ️  Super admin already exists:', existingUser.email);
    } else {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash('Admin@123456', salt);

        const adminUser = await prisma.user.create({
            data: {
                email,
                phone,
                passwordHash,
                fullName: 'Admin',
                entityId: entity.id,
                roleId: roleMap['SUPER_ADMIN'],
                isActive: true,
            },
        });

        console.log('✅ Super Admin created:', adminUser.email);
    }

    console.log('\n🎉 Seed complete!');
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
