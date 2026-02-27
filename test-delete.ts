import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
    console.log("Starting deletion...");
    try {
        const entityToDelete = await prisma.entity.findFirst();
        if (!entityToDelete) {
            console.log("No entities found.");
            return;
        }
        console.log(`Deleting entity: ${entityToDelete.id} (${entityToDelete.name})`);

        // Wait 2s to allow connection pool
        await new Promise(r => setTimeout(r, 2000));

        await prisma.entity.delete({
            where: { id: entityToDelete.id }
        });
        console.log("Deletion successful.");
    } catch (e) {
        console.error("Deletion failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
