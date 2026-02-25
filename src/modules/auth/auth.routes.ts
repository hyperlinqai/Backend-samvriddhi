import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../infrastructure/middleware/auth.middleware';
import { validate } from '../../infrastructure/middleware/validate.middleware';
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    changePasswordSchema,
} from './auth.validation';

const authRouter = Router();

authRouter.post(
    '/register',
    validate({ body: registerSchema }),
    authController.register
);

authRouter.post(
    '/login',
    validate({ body: loginSchema }),
    authController.login
);

authRouter.post(
    '/refresh-token',
    validate({ body: refreshTokenSchema }),
    authController.refreshToken
);

authRouter.post(
    '/change-password',
    authenticate,
    validate({ body: changePasswordSchema }),
    authController.changePassword
);

authRouter.get(
    '/profile',
    authenticate,
    authController.getProfile
);

export { authRouter };
