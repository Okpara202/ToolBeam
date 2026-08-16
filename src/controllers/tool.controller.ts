import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/constants/category';
import { SUCCESS_MESSAGE } from '@/constants/message';
import { getPopularTools, getRelatedTools } from '@/services/ranking.service';
import { createTool, getRecentTools, getToolById, listTools } from '@/services/tool.service';
import { removeUpvote, upvoteTool } from '@/services/upvote.service';
import type {
  CreateToolInput,
  ListToolsQuery,
  PopularToolsQuery,
  RecentToolsQuery,
  RelatedToolsQuery,
} from '@/validations/tool.validation';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

/** Coerced/defaulted query params land on `validatedQuery` — see express.d.ts. */
const query = <T>(req: Request): T => req.validatedQuery as T;

export const createToolHandler = async (
  req: Request<unknown, unknown, CreateToolInput>,
  res: Response,
) => {
  const tool = await createTool(req.user!.id, req.body);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: SUCCESS_MESSAGE.TOOL_SUBMITTED,
    data: tool,
  });
};

export const listToolsHandler = async (req: Request, res: Response) => {
  const { tools, pagination } = await listTools(query<ListToolsQuery>(req));

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.TOOLS_FETCHED,
    data: tools,
    pagination,
  });
};

export const getRecentToolsHandler = async (req: Request, res: Response) => {
  const { page, limit } = query<RecentToolsQuery>(req);
  const { tools, pagination } = await getRecentTools(page, limit);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.RECENT_TOOLS_FETCHED,
    data: tools,
    pagination,
  });
};

export const getPopularToolsHandler = async (req: Request, res: Response) => {
  const { limit, window } = query<PopularToolsQuery>(req);
  const tools = await getPopularTools(limit, window);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.POPULAR_TOOLS_FETCHED,
    // Echoed so a client can tell an all-time ranking apart from a trending one
    // without having to remember what it asked for.
    window,
    data: tools,
  });
};

export const getToolByIdHandler = async (req: Request<{ id: string }>, res: Response) => {
  const tool = await getToolById(req.params.id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.TOOL_FETCHED,
    data: tool,
  });
};

export const getRelatedToolsHandler = async (req: Request<{ id: string }>, res: Response) => {
  const { limit } = query<RelatedToolsQuery>(req);
  const { source, related } = await getRelatedTools(req.params.id, limit);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.RELATED_TOOLS_FETCHED,
    source,
    data: related,
  });
};

export const upvoteToolHandler = async (req: Request<{ id: string }>, res: Response) => {
  const data = await upvoteTool(req.user!.id, req.params.id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.UPVOTED,
    data,
  });
};

export const removeUpvoteHandler = async (req: Request<{ id: string }>, res: Response) => {
  const data = await removeUpvote(req.user!.id, req.params.id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.UPVOTE_REMOVED,
    data,
  });
};

export const listCategoriesHandler = async (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.CATEGORIES_FETCHED,
    data: CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value as Category] })),
  });
};
