import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    API_VERSION: z.string().default('v1'),

    // Database
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    LOG_DIR: z.string().default('logs'),

    // CORS
    CORS_ORIGIN: z.string().default('*'),

    // Uploads
    UPLOAD_DIR: z.string().default('uploads'),
    MAX_FILE_SIZE_MB: z.coerce.number().default(10),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

    // Bcrypt
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
}

export const config = Object.freeze(parsed.data);

export type Config = z.infer<typeof envSchema>;
