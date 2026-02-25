import { prisma } from '../../infrastructure/database/prisma';
import { Attendance, AttendanceStatus, Prisma } from '@prisma/client';

export class AttendanceRepository {
    /**
     * Find today's attendance record for a user
     */
    async findTodayByUserId(userId: string): Promise<Attendance | null> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });
    }

    /**
     * Create a new attendance record
     */
    async create(data: Prisma.AttendanceUncheckedCreateInput): Promise<Attendance> {
        return prisma.attendance.create({
            data,
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, role: true },
                },
            },
        });
    }

    /**
     * Update an attendance record
     */
    async update(
        id: string,
        data: Prisma.AttendanceUncheckedUpdateInput
    ): Promise<Attendance> {
        return prisma.attendance.update({
            where: { id },
            data,
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, role: true },
                },
            },
        });
    }

    /**
     * Find by ID
     */
    async findById(id: string): Promise<Attendance | null> {
        return prisma.attendance.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, role: true },
                },
                visits: true,
            },
        });
    }

    /**
     * List attendance records with filters and pagination
     */
    async findMany(params: {
        userId?: string;
        startDate?: Date;
        endDate?: Date;
        status?: AttendanceStatus;
        page: number;
        limit: number;
        sortBy: string;
        sortOrder: 'asc' | 'desc';
    }): Promise<{ data: Attendance[]; total: number }> {
        const where: Prisma.AttendanceWhereInput = {};

        if (params.userId) {
            where.userId = params.userId;
        }

        if (params.startDate || params.endDate) {
            where.date = {};
            if (params.startDate) {
                where.date.gte = params.startDate;
            }
            if (params.endDate) {
                where.date.lte = params.endDate;
            }
        }

        if (params.status) {
            where.status = params.status;
        }

        const [data, total] = await Promise.all([
            prisma.attendance.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, fullName: true, email: true, role: true },
                    },
                },
                orderBy: { [params.sortBy]: params.sortOrder },
                skip: (params.page - 1) * params.limit,
                take: params.limit,
            }),
            prisma.attendance.count({ where }),
        ]);

        return { data, total };
    }

    /**
     * Find all open check-ins (CHECKED_IN status) — for auto-close cron
     */
    async findOpenCheckIns(): Promise<Attendance[]> {
        return prisma.attendance.findMany({
            where: {
                status: 'CHECKED_IN',
                date: {
                    lt: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        });
    }

    /**
     * Bulk auto-close stale check-ins
     */
    async autoCloseStaleCheckIns(): Promise<number> {
        const result = await prisma.attendance.updateMany({
            where: {
                status: 'CHECKED_IN',
                date: {
                    lt: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
            data: {
                status: 'AUTO_CLOSED',
                checkOutTime: new Date(),
            },
        });

        return result.count;
    }

    /**
     * Get attendance summary for a user in a date range
     */
    async getSummary(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalDays: number;
        avgWorkingHours: number;
        totalWorkingHours: number;
        autoClosedCount: number;
    }> {
        const records = await prisma.attendance.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate },
            },
            select: {
                workingHours: true,
                status: true,
            },
        });

        const totalDays = records.length;
        const totalWorkingHours = records.reduce(
            (sum, r) => sum + (r.workingHours || 0),
            0
        );
        const avgWorkingHours = totalDays > 0 ? totalWorkingHours / totalDays : 0;
        const autoClosedCount = records.filter(
            (r) => r.status === 'AUTO_CLOSED'
        ).length;

        return {
            totalDays,
            avgWorkingHours: Math.round(avgWorkingHours * 100) / 100,
            totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
            autoClosedCount,
        };
    }
}

export const attendanceRepository = new AttendanceRepository();
