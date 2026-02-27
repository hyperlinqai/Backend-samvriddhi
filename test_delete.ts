import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDelete() {
    try {
        const entities = await prisma.entity.findMany({ take: 1 });
        if (entities.length === 0) {
            console.log("No entities found to delete.");
            return;
        }

        const testEntity = entities[0];
        console.log("Attempting to delete entity:", testEntity.id, testEntity.name);

        // Try hard delete
        const result = await prisma.entity.delete({
            where: { id: testEntity.id }
        });

        console.log("Delete successful:", result);
    } catch (e: any) {
        console.error("PRISMA DELETE ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testDelete();
