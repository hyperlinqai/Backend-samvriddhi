import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { hasPermission } from '../../infrastructure/middleware/rbac.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import {
    checkInSchema,
    checkOutSchema,
    getAttendanceSchema,
    attendanceIdParamSchema,
} from './attendance.validation';

const attendanceRouter = Router();

// All routes require authentication
attendanceRouter.use(authenticate);

// ─── Check-in / Check-out ──────────────────────────────
attendanceRouter.post(
    '/check-in',
    validate({ body: checkInSchema }),
    attendanceController.checkIn
);

attendanceRouter.post(
    '/check-out',
    validate({ body: checkOutSchema }),
    attendanceController.checkOut
);

// ─── Today's Status ────────────────────────────────────
attendanceRouter.get('/today', attendanceController.getTodayStatus);

// ─── Summary ───────────────────────────────────────────
attendanceRouter.get('/summary', attendanceController.getSummary);

// ─── Auto-close (admin only) ──────────────────────────
attendanceRouter.post(
    '/auto-close',
    hasPermission('attendance.read'),
    attendanceController.autoClose
);

// ─── List ──────────────────────────────────────────────
attendanceRouter.get(
    '/',
    validate({ query: getAttendanceSchema }),
    attendanceController.list
);

// ─── Get by ID ─────────────────────────────────────────
attendanceRouter.get(
    '/:id',
    validate({ params: attendanceIdParamSchema }),
    attendanceController.getById
);

export { attendanceRouter };
