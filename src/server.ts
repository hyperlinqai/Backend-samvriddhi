import { app } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma';
import { logger } from './infrastructure/logger';

const startServer = async (): Promise<void> => {
    try {
        // Connect to database
        await connectDatabase();

        // Start listening
        const server = app.listen(config.PORT, () => {
            logger.info(`🚀 Server running on port ${config.PORT}`);
            logger.info(`📌 Environment: ${config.NODE_ENV}`);
            logger.info(`📌 API version: ${config.API_VERSION}`);
            logger.info(`📌 Health check: http://localhost:${config.PORT}/health`);
        });

        // ─── Graceful Shutdown ──────────────────────────────
        const gracefulShutdown = async (signal: string): Promise<void> => {
            logger.info(`${signal} received. Starting graceful shutdown...`);

            server.close(async () => {
                logger.info('HTTP server closed');
                await disconnectDatabase();
                logger.info('Database disconnected');
                process.exit(0);
            });

            // Force shutdown after 30 seconds
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error: Error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason: unknown) => {
            logger.error('Unhandled Rejection:', reason);
            process.exit(1);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
