import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/database/prisma';
import { config } from '../../config';
import {
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
} from '../../shared/errors/AppError';
import { JwtPayload } from '../../shared/types';
import { RegisterInput, LoginInput, ChangePasswordInput } from './auth.validation';
import { AuthTokens, LoginResponse } from './auth.types';

export class AuthService {
    /**
     * Register a new user
     */
    async register(data: RegisterInput): Promise<LoginResponse> {
        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { phone: data.phone }],
            },
        });

        if (existingUser) {
            throw new ConflictError(
                existingUser.email === data.email
                    ? 'Email already registered'
                    : 'Phone number already registered'
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, config.BCRYPT_SALT_ROUNDS);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: data.email,
                phone: data.phone,
                passwordHash,
                fullName: data.fullName,
                entityId: data.entityId,
                roleId: data.roleId,
                reportingTo: data.reportingTo,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                isActive: true,
                avatarUrl: true,
                roleRecord: {
                    select: { id: true, name: true, level: true },
                },
                entity: {
                    select: { id: true, name: true, code: true },
                },
            },
        });

        const roleName = user.roleRecord?.name ?? 'USER';
        const roleLevel = user.roleRecord?.level ?? 0;

        // Fetch permissions for the role
        const permissions = user.roleRecord
            ? (await prisma.rolePermission.findMany({
                where: { roleId: user.roleRecord.id },
                include: { permission: { select: { name: true } } },
            })).map((rp) => rp.permission.name)
            : [];

        // Generate tokens
        const tokens = this.generateTokens({
            userId: user.id,
            email: user.email,
            roleName,
            roleLevel,
            permissions,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: roleName,
                phone: user.phone,
                isActive: user.isActive,
                avatarUrl: user.avatarUrl,
            },
            tokens,
        };
    }

    /**
     * Authenticate a user
     */
    async login(data: LoginInput): Promise<LoginResponse> {
        // Find user with role
        const user = await prisma.user.findUnique({
            where: { email: data.email },
            include: {
                roleRecord: {
                    select: { id: true, name: true, level: true },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedError('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedError('Account is deactivated. Contact your administrator.');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const roleName = user.roleRecord?.name ?? 'USER';
        const roleLevel = user.roleRecord?.level ?? 0;

        // Fetch permissions for the role
        const permissions = user.roleRecord
            ? (await prisma.rolePermission.findMany({
                where: { roleId: user.roleRecord.id },
                include: { permission: { select: { name: true } } },
            })).map((rp) => rp.permission.name)
            : [];

        // Generate tokens
        const tokens = this.generateTokens({
            userId: user.id,
            email: user.email,
            roleName,
            roleLevel,
            permissions,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: roleName,
                phone: user.phone,
                isActive: user.isActive,
                avatarUrl: user.avatarUrl,
            },
            tokens,
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken: string): Promise<AuthTokens> {
        try {
            const decoded = jwt.verify(
                refreshToken,
                config.JWT_REFRESH_SECRET
            ) as JwtPayload;

            // Verify user still exists and is active
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    isActive: true,
                    roleId: true,
                    roleRecord: {
                        select: { id: true, name: true, level: true },
                    },
                },
            });

            if (!user || !user.isActive) {
                throw new UnauthorizedError('Invalid refresh token');
            }

            // Fetch permissions for the role
            const permissions = user.roleId
                ? (await prisma.rolePermission.findMany({
                    where: { roleId: user.roleId },
                    include: { permission: { select: { name: true } } },
                })).map((rp) => rp.permission.name)
                : [];

            return this.generateTokens({
                userId: user.id,
                email: user.email,
                roleName: user.roleRecord?.name ?? 'USER',
                roleLevel: user.roleRecord?.level ?? 0,
                permissions,
            });
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedError('Refresh token has expired');
            }
            if (error instanceof UnauthorizedError) {
                throw error;
            }
            throw new UnauthorizedError('Invalid refresh token');
        }
    }

    /**
     * Change user's password
     */
    async changePassword(userId: string, data: ChangePasswordInput): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            data.currentPassword,
            user.passwordHash
        );

        if (!isCurrentPasswordValid) {
            throw new BadRequestError('Current password is incorrect');
        }

        const newPasswordHash = await bcrypt.hash(
            data.newPassword,
            config.BCRYPT_SALT_ROUNDS
        );

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash },
        });
    }

    /**
     * Get current user's profile
     */
    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                fullName: true,
                isActive: true,
                avatarUrl: true,
                reportingTo: true,
                createdAt: true,
                entity: {
                    select: { id: true, name: true, code: true },
                },
                roleRecord: {
                    select: { id: true, name: true, level: true },
                },
                reportingToUser: {
                    select: { id: true, fullName: true, email: true },
                },
            },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return user;
    }

    /**
     * Generate JWT access & refresh tokens
     */
    private generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>): AuthTokens {
        const accessToken = jwt.sign(payload, config.JWT_SECRET, {
            expiresIn: config.JWT_EXPIRES_IN as string & jwt.SignOptions['expiresIn'],
        });

        const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
            expiresIn: config.JWT_REFRESH_EXPIRES_IN as string & jwt.SignOptions['expiresIn'],
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: config.JWT_EXPIRES_IN,
        };
    }
}

export const authService = new AuthService();
