import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

export function sendSuccess<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200
): Response {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
    };
    return res.status(statusCode).json(response);
}

export function sendCreated<T>(
    res: Response,
    data: T,
    message: string = 'Created successfully'
): Response {
    return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
    res: Response,
    result: PaginatedResponse<T>,
    message: string = 'Success'
): Response {
    const response: ApiResponse<T[]> = {
        success: true,
        message,
        data: result.data,
        meta: result.meta as unknown as Record<string, unknown>,
    };
    return res.status(200).json(response);
}

export function sendNoContent(res: Response): Response {
    return res.status(204).send();
}

export function sendError(
    res: Response,
    message: string,
    statusCode: number = 500,
    errors?: Record<string, string[]>
): Response {
    const response: ApiResponse = {
        success: false,
        message,
        errors,
    };
    return res.status(statusCode).json(response);
}
