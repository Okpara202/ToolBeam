import { listCategoriesHandler } from '@/controllers/tool.controller';
import authRouter from '@/routes/auth.routes';
import toolRouter from '@/routes/tool.routes';
import { Router } from 'express';

const router = Router();

router.use('/auth', authRouter);
router.use('/tools', toolRouter);
router.get('/categories', listCategoriesHandler);

export default router;
