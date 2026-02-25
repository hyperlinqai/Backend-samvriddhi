import { z } from 'zod';

export const checkInSchema = z.object({
    lat: z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90'),
    lng: z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180'),
    address: z.string().optional(),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export const checkOutSchema = z.object({
    lat: z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90'),
    lng: z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180'),
    address: z.string().optional(),
    notes: z.string().max(500).optional(),
});

export const getAttendanceSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
    userId: z.string().uuid().optional(),
    status: z.enum(['CHECKED_IN', 'CHECKED_OUT', 'AUTO_CLOSED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(['date', 'checkInTime', 'workingHours', 'createdAt']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const attendanceIdParamSchema = z.object({
    id: z.string().uuid('Invalid attendance ID'),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type GetAttendanceQuery = z.infer<typeof getAttendanceSchema>;
