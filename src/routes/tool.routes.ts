import {
  createToolHandler,
  getPopularToolsHandler,
  getRecentToolsHandler,
  getRelatedToolsHandler,
  getToolByIdHandler,
  listToolsHandler,
  removeUpvoteHandler,
  upvoteToolHandler,
} from '@/controllers/tool.controller';
import { authenticate } from '@/middlewares/authentication.middleware';
import { validateSchema } from '@/middlewares/validation.middleware';
import {
  createToolSchema,
  listToolsQuerySchema,
  popularToolsQuerySchema,
  recentToolsQuerySchema,
  relatedToolsQuerySchema,
} from '@/validations/tool.validation';
import { Router } from 'express';

const router = Router();

// --- public reads --------------------------------------------------------

router.get('/', validateSchema(listToolsQuerySchema, 'query'), listToolsHandler);

// ⚠️ ORDER IS LOAD-BEARING ⚠️
// `/recent` and `/popular` MUST stay above `/:id`. Express matches routes top
// to bottom, so if `/:id` were declared first it would match the literal
// strings "recent" and "popular" as an id and the request would die trying to
// cast them to an ObjectId. Add new literal sub-paths above this line, never
// below it.
router.get('/recent', validateSchema(recentToolsQuerySchema, 'query'), getRecentToolsHandler);
router.get('/popular', validateSchema(popularToolsQuerySchema, 'query'), getPopularToolsHandler);

router.get('/:id', getToolByIdHandler);
router.get('/:id/related', validateSchema(relatedToolsQuerySchema, 'query'), getRelatedToolsHandler);

// --- authenticated writes ------------------------------------------------

router.post('/', authenticate, validateSchema(createToolSchema), createToolHandler);
router.post('/:id/upvote', authenticate, upvoteToolHandler);
router.delete('/:id/upvote', authenticate, removeUpvoteHandler);

export default router;
