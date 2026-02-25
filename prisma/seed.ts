import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...\n');

    // ─── Create Users ──────────────────────────────────────
    const passwordHash = await bcrypt.hash('Admin@123456', 12);

    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@samvirddhi.com' },
        update: {},
        create: {
            email: 'superadmin@samvirddhi.com',
            phone: '9000000001',
            passwordHash,
            fullName: 'Super Admin',
            role: Role.SUPER_ADMIN,
            isActive: true,
        },
    });
    console.log(`✅ Super Admin created: ${superAdmin.email}`);

    const smAdmin = await prisma.user.upsert({
        where: { email: 'admin@samvirddhi.com' },
        update: {},
        create: {
            email: 'admin@samvirddhi.com',
            phone: '9000000002',
            passwordHash,
            fullName: 'State Manager',
            role: Role.SM_ADMIN,
            managerId: superAdmin.id,
            isActive: true,
        },
    });
    console.log(`✅ SM/Admin created: ${smAdmin.email}`);

    const rm1 = await prisma.user.upsert({
        where: { email: 'rm1@samvirddhi.com' },
        update: {},
        create: {
            email: 'rm1@samvirddhi.com',
            phone: '9000000003',
            passwordHash,
            fullName: 'Rajesh Kumar (RM)',
            role: Role.RM,
            managerId: smAdmin.id,
            isActive: true,
        },
    });
    console.log(`✅ RM created: ${rm1.email}`);

    const rm2 = await prisma.user.upsert({
        where: { email: 'rm2@samvirddhi.com' },
        update: {},
        create: {
            email: 'rm2@samvirddhi.com',
            phone: '9000000004',
            passwordHash,
            fullName: 'Priya Sharma (RM)',
            role: Role.RM,
            managerId: smAdmin.id,
            isActive: true,
        },
    });
    console.log(`✅ RM created: ${rm2.email}`);

    const accountsUser = await prisma.user.upsert({
        where: { email: 'accounts@samvirddhi.com' },
        update: {},
        create: {
            email: 'accounts@samvirddhi.com',
            phone: '9000000005',
            passwordHash,
            fullName: 'Accounts Team',
            role: Role.ACCOUNTS,
            managerId: superAdmin.id,
            isActive: true,
        },
    });
    console.log(`✅ Accounts user created: ${accountsUser.email}`);

    // ─── Create Routes ────────────────────────────────────
    const route1 = await prisma.route.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Delhi NCR - Route A',
            description: 'Covers Noida, Greater Noida, and Ghaziabad',
            areas: [
                { name: 'Noida', lat: 28.5355, lng: 77.3910, radius: 15 },
                { name: 'Greater Noida', lat: 28.4744, lng: 77.5040, radius: 10 },
                { name: 'Ghaziabad', lat: 28.6692, lng: 77.4538, radius: 12 },
            ],
        },
    });
    console.log(`✅ Route created: ${route1.name}`);

    const route2 = await prisma.route.upsert({
        where: { id: '00000000-0000-0000-0000-000000000002' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000002',
            name: 'Delhi NCR - Route B',
            description: 'Covers Gurugram and Faridabad',
            areas: [
                { name: 'Gurugram', lat: 28.4595, lng: 77.0266, radius: 15 },
                { name: 'Faridabad', lat: 28.4089, lng: 77.3178, radius: 10 },
            ],
        },
    });
    console.log(`✅ Route created: ${route2.name}`);

    // ─── Create CSPs ──────────────────────────────────────
    await prisma.cSP.upsert({
        where: { code: 'CSP-NOI-001' },
        update: {},
        create: {
            name: 'Noida Branch CSP',
            code: 'CSP-NOI-001',
            routeId: route1.id,
            lat: 28.5355,
            lng: 77.3910,
            address: 'Sector 62, Noida, UP 201301',
            contactPerson: 'Amit Verma',
            phone: '9876543210',
        },
    });

    await prisma.cSP.upsert({
        where: { code: 'CSP-GGN-001' },
        update: {},
        create: {
            name: 'Gurugram Main CSP',
            code: 'CSP-GGN-001',
            routeId: route2.id,
            lat: 28.4595,
            lng: 77.0266,
            address: 'Cyber City, Gurugram, HR 122002',
            contactPerson: 'Sunita Rani',
            phone: '9876543211',
        },
    });
    console.log('✅ CSPs created');

    // ─── Assign Routes ────────────────────────────────────
    await prisma.routeAssignment.upsert({
        where: {
            userId_routeId_startDate: {
                userId: rm1.id,
                routeId: route1.id,
                startDate: new Date('2025-01-01'),
            },
        },
        update: {},
        create: {
            userId: rm1.id,
            routeId: route1.id,
            startDate: new Date('2025-01-01'),
            isActive: true,
        },
    });

    await prisma.routeAssignment.upsert({
        where: {
            userId_routeId_startDate: {
                userId: rm2.id,
                routeId: route2.id,
                startDate: new Date('2025-01-01'),
            },
        },
        update: {},
        create: {
            userId: rm2.id,
            routeId: route2.id,
            startDate: new Date('2025-01-01'),
            isActive: true,
        },
    });
    console.log('✅ Route assignments created');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Login credentials (all users):');
    console.log('   Password: Admin@123456');
    console.log('\n👤 Users:');
    console.log('   Super Admin: superadmin@samvirddhi.com');
    console.log('   SM/Admin:    admin@samvirddhi.com');
    console.log('   RM 1:        rm1@samvirddhi.com');
    console.log('   RM 2:        rm2@samvirddhi.com');
    console.log('   Accounts:    accounts@samvirddhi.com');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
