import { attendanceRepository } from './attendance.repository';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { CheckInInput, CheckOutInput, GetAttendanceQuery } from './attendance.validation';
import { PaginatedResponse } from '../../shared/types';
import { Attendance } from '@prisma/client';
import { logger } from '../../infrastructure/logger';

export class AttendanceService {
    /**
     * GPS-based check-in
     */
    async checkIn(
        userId: string,
        data: CheckInInput
    ): Promise<Attendance> {
        // Check if already checked in today
        const existing = await attendanceRepository.findTodayByUserId(userId);

        if (existing) {
            if (existing.status === 'CHECKED_IN') {
                throw new BadRequestError(
                    'You are already checked in. Please check out first.'
                );
            }
            throw new BadRequestError(
                'Attendance already recorded for today. Contact admin for corrections.'
            );
        }

        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const attendance = await attendanceRepository.create({
            userId,
            date: today,
            checkInTime: now,
            checkInLat: data.lat,
            checkInLng: data.lng,
            checkInAddress: data.address,
            status: 'CHECKED_IN',
            notes: data.notes,
        });

        logger.info(`User ${userId} checked in at ${now.toISOString()}`, {
            attendanceId: attendance.id,
            lat: data.lat,
            lng: data.lng,
        });

        return attendance;
    }

    /**
     * GPS-based check-out
     */
    async checkOut(
        userId: string,
        data: CheckOutInput
    ): Promise<Attendance> {
        const today = await attendanceRepository.findTodayByUserId(userId);

        if (!today) {
            throw new BadRequestError('No check-in found for today. Please check in first.');
        }

        if (today.status !== 'CHECKED_IN') {
            throw new BadRequestError('Already checked out for today.');
        }

        const now = new Date();
        const checkInTime = new Date(today.checkInTime);
        const workingHours =
            (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        const attendance = await attendanceRepository.update(today.id, {
            checkOutTime: now,
            checkOutLat: data.lat,
            checkOutLng: data.lng,
            checkOutAddress: data.address,
            status: 'CHECKED_OUT',
            workingHours: Math.round(workingHours * 100) / 100,
            notes: data.notes ? `${today.notes || ''}\n${data.notes}`.trim() : today.notes,
        });

        logger.info(`User ${userId} checked out. Working hours: ${workingHours.toFixed(2)}`, {
            attendanceId: attendance.id,
            workingHours: Math.round(workingHours * 100) / 100,
        });

        return attendance;
    }

    /**
     * Get today's attendance status for the current user
     */
    async getTodayStatus(userId: string): Promise<Attendance | null> {
        return attendanceRepository.findTodayByUserId(userId);
    }

    /**
     * Get a single attendance record by ID
     */
    async getById(id: string): Promise<Attendance> {
        const attendance = await attendanceRepository.findById(id);

        if (!attendance) {
            throw new NotFoundError('Attendance record not found');
        }

        return attendance;
    }

    /**
     * List attendance records with filters and pagination
     */
    async list(
        query: GetAttendanceQuery,
        requestingUserId: string,
        visibleUserIds: string[] | null
    ): Promise<PaginatedResponse<Attendance>> {
        // If visibleUserIds is null (Super Admin), allow any userId filter
        // Otherwise restrict to downline
        let userId = query.userId;
        if (visibleUserIds !== null) {
            if (userId && !visibleUserIds.includes(userId)) {
                userId = requestingUserId; // fallback to self
            } else if (!userId) {
                // No specific user requested — show all visible users
            }
        }

        const { data, total } = await attendanceRepository.findMany({
            userId,
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            status: query.status as 'CHECKED_IN' | 'CHECKED_OUT' | 'AUTO_CLOSED' | undefined,
            page: query.page,
            limit: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        const totalPages = Math.ceil(total / query.limit);

        return {
            data,
            meta: {
                total,
                page: query.page,
                limit: query.limit,
                totalPages,
                hasNext: query.page < totalPages,
                hasPrev: query.page > 1,
            },
        };
    }

    /**
     * Get attendance summary for a user
     */
    async getSummary(
        userId: string,
        startDate: string,
        endDate: string
    ) {
        return attendanceRepository.getSummary(
            userId,
            new Date(startDate),
            new Date(endDate)
        );
    }

    /**
     * Auto-close stale check-ins (for cron job)
     */
    async autoCloseStale(): Promise<number> {
        const count = await attendanceRepository.autoCloseStaleCheckIns();

        if (count > 0) {
            logger.warn(`Auto-closed ${count} stale attendance records`);
        }

        return count;
    }
}

export const attendanceService = new AttendanceService();
