export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}

export interface AuthUser {
    id: string;
    email: string;
    fullName: string;
    role: string;
    phone: string;
    isActive: boolean;
    avatarUrl: string | null;
}

export interface LoginResponse {
    user: AuthUser;
    tokens: AuthTokens;
}
