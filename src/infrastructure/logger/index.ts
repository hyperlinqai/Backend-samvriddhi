import winston from 'winston';
import path from 'path';
import { config } from '../../config';
import fs from 'fs';

// Ensure log directory exists
const logDir = path.resolve(process.cwd(), config.LOG_DIR);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

export const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: logFormat,
    defaultMeta: { service: 'samvirddhi-attendance' },
    transports: [
        // Console transport (always)
        new winston.transports.Console({
            format: consoleFormat,
        }),

        // File transport: all logs
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true,
        }),

        // File transport: errors only
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
            tailable: true,
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log'),
        }),
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log'),
        }),
    ],
});

// Stream for Morgan HTTP logging (if needed later)
export const httpLogStream = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};
