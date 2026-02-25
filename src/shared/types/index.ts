import { Role } from '@prisma/client';

export interface JwtPayload {
    userId: string;
    email: string;
    role: Role;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedRequest {
    user: {
        userId: string;
        email: string;
        role: Role;
    };
}

export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    errors?: Record<string, string[]>;
    meta?: Record<string, unknown>;
}

export interface GeoCoordinates {
    lat: number;
    lng: number;
}
