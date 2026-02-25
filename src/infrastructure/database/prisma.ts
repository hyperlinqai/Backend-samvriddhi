import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log:
            config.NODE_ENV === 'development'
                ? [
                    { emit: 'event', level: 'query' },
                    { emit: 'stdout', level: 'info' },
                    { emit: 'stdout', level: 'warn' },
                    { emit: 'stdout', level: 'error' },
                ]
                : [
                    { emit: 'stdout', level: 'warn' },
                    { emit: 'stdout', level: 'error' },
                ],
    });

if (config.NODE_ENV === 'development') {
    prisma.$on('query' as never, (e: { query: string; duration: number }) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Duration: ${e.duration}ms`);
    });
}

if (config.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        logger.info('✅ Database connected successfully');
    } catch (error) {
        logger.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    logger.info('Database disconnected');
}
