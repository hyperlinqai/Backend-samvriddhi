import { Attendance, AttendanceStatus } from '@prisma/client';

export interface AttendanceRecord {
    id: string;
    userId: string;
    date: Date;
    checkInTime: Date;
    checkOutTime: Date | null;
    checkInLat: number;
    checkInLng: number;
    checkOutLat: number | null;
    checkOutLng: number | null;
    checkInAddress: string | null;
    checkOutAddress: string | null;
    status: AttendanceStatus;
    workingHours: number | null;
    notes: string | null;
    user?: {
        id: string;
        fullName: string;
        email: string;
        role: string;
    };
}

export interface AttendanceSummary {
    totalDays: number;
    presentDays: number;
    avgWorkingHours: number;
    totalWorkingHours: number;
    autoClosedCount: number;
}

export interface CheckInResult {
    attendance: Attendance;
    message: string;
}

export interface CheckOutResult {
    attendance: Attendance;
    workingHours: number;
    message: string;
}
