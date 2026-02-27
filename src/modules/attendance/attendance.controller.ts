import { Request, Response } from 'express';
import { attendanceService } from './attendance.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import { getVisibleUserIds } from '../../shared/utils/downline.util';

export class AttendanceController {
    /**
     * POST /attendance/check-in
     */
    checkIn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const attendance = await attendanceService.checkIn(req.user!.userId, req.body);
        sendCreated(res, attendance, 'Checked in successfully');
    });

    /**
     * POST /attendance/check-out
     */
    checkOut = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const attendance = await attendanceService.checkOut(req.user!.userId, req.body);
        sendSuccess(res, attendance, 'Checked out successfully');
    });

    /**
     * GET /attendance/today
     */
    getTodayStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const status = await attendanceService.getTodayStatus(req.user!.userId);
        sendSuccess(res, status, status ? 'Today\'s attendance found' : 'No attendance record for today');
    });

    /**
     * GET /attendance/:id
     */
    getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const attendance = await attendanceService.getById(req.params.id as string);
        sendSuccess(res, attendance);
    });

    /**
     * GET /attendance
     */
    list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const visibleIds = await getVisibleUserIds(req.user!.userId, req.user!.roleName);
        const result = await attendanceService.list(
            req.query as never,
            req.user!.userId,
            visibleIds
        );
        sendPaginated(res, result, 'Attendance records fetched');
    });

    /**
     * GET /attendance/summary
     */
    getSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { userId, startDate, endDate } = req.query as {
            userId?: string;
            startDate: string;
            endDate: string;
        };

        const targetUserId = userId || req.user!.userId;
        const summary = await attendanceService.getSummary(
            targetUserId,
            startDate,
            endDate
        );
        sendSuccess(res, summary, 'Attendance summary fetched');
    });

    /**
     * POST /attendance/auto-close (admin only, for cron)
     */
    autoClose = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
        const count = await attendanceService.autoCloseStale();
        sendSuccess(res, { closedCount: count }, `Auto-closed ${count} stale records`);
    });
}

export const attendanceController = new AttendanceController();
