const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPerms() {
    const perms = await prisma.permission.findMany({ take: 5 });
    console.log(perms);
    await prisma.$disconnect();
}
checkPerms();
