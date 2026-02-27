import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// import rateLimit from 'express-rate-limit';
import { config } from './config';
import { requestId } from './infrastructure/middleware/requestId.middleware';
import { errorHandler, notFoundHandler } from './infrastructure/middleware/error.middleware';
import { apiRouter } from './routes';

const app = express();

// ─── Security ────────────────────────────────────────────
app.use(helmet());
app.use(
    cors({
        origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
);

// ─── Rate Limiting ───────────────────────────────────────
/*
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
    },
});
app.use(limiter);
*/

// ─── Request Parsing ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── Request ID ──────────────────────────────────────────
app.use(requestId);

// ─── Root Route ──────────────────────────────────────────
app.get('/', (_req, res) => {
    console.log('--- ROOT ROUTE HIT ---');
    res.json({
        success: true,
        message: 'Samvriddhi Attendance API Running',
    });
});

// ─── Health Check ────────────────────────────────────────
app.get('/health', (_req, res) => {
    console.log('--- HEALTH ROUTE HIT ---');
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
    });
});

app.get('/ping', (_req, res) => {
    res.send('pong');
});

// ─── API Routes ──────────────────────────────────────────
app.use(`/api/${config.API_VERSION}`, apiRouter);

// ─── Static Files (uploads) ─────────────────────────────
app.use('/uploads', express.static(config.UPLOAD_DIR));

// ─── Error Handling ──────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
