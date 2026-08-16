import { getProfileHandler, loginHandler, registerHandler } from '@/controllers/auth.controller';
import { authenticate } from '@/middlewares/authentication.middleware';
import { validateSchema } from '@/middlewares/validation.middleware';
import { loginSchema, registerSchema } from '@/validations/auth.validation';
import { Router } from 'express';

const router = Router();

router.post('/register', validateSchema(registerSchema), registerHandler);
router.post('/login', validateSchema(loginSchema), loginHandler);
router.get('/me', authenticate, getProfileHandler);

export default router;
