import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../shared/utils/response';

export class AuthController {
    register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const result = await authService.register(req.body);
        sendCreated(res, result, 'User registered successfully');
    });

    login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const result = await authService.login(req.body);
        sendSuccess(res, result, 'Login successful');
    });

    refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshToken(refreshToken);
        sendSuccess(res, tokens, 'Token refreshed successfully');
    });

    changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        await authService.changePassword(req.user!.userId, req.body);
        sendSuccess(res, null, 'Password changed successfully');
    });

    getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const profile = await authService.getProfile(req.user!.userId);
        sendSuccess(res, profile, 'Profile fetched successfully');
    });
}

export const authController = new AuthController();
