import { ErrorCode } from '@/constants/error-code';
import { ERROR_MESSAGE } from '@/constants/message';
import Tool, { type ToolDocument } from '@/db/models/tool.model';
import { conflict, notFound } from '@/errors/AppError';
import { escapeRegExp, extractKeywords, normalizeLink, normalizeTags } from '@/utils/helper.util';
import { isDuplicateKeyError, toObjectId } from '@/utils/mongo.util';
import type { CreateToolInput, ListToolsQuery } from '@/validations/tool.validation';
import type { QueryFilter } from 'mongoose';

/**
 * The public shape of a tool, as a `$project` stage.
 *
 * Ranking runs through aggregation pipelines (which yield plain objects) while
 * simple reads run through `find()` (which yields documents). Both paths have
 * to emit an identical shape or clients would see the response change depending
 * on which endpoint they hit — this stage and `sanitizeTool` below are the two
 * halves of that contract, and they must be kept in step.
 *
 * `linkKey` and `keywords` are internal ranking machinery and stay unexported.
 */
export const TOOL_PROJECTION = {
  _id: 0,
  id: { $toString: '$_id' },
  name: 1,
  description: 1,
  category: 1,
  link: 1,
  tags: 1,
  submittedBy: { $toString: '$submittedBy' },
  upvoteCount: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

/** `TOOL_PROJECTION` plus any scoring fields a ranking pipeline wants to expose. */
export const toolProjectionStage = (extra: Record<string, unknown> = {}) => ({
  $project: { ...TOOL_PROJECTION, ...extra },
});

export const sanitizeTool = (tool: ToolDocument) => ({
  id: tool._id.toString(),
  name: tool.name,
  description: tool.description,
  category: tool.category,
  link: tool.link,
  tags: tool.tags,
  submittedBy: tool.submittedBy.toString(),
  upvoteCount: tool.upvoteCount,
  createdAt: tool.createdAt,
  updatedAt: tool.updatedAt,
});

/**
 * The canonical tool shape, derived from `sanitizeTool` itself so the ranking
 * pipelines cannot drift from the simple reads without a type error.
 */
export type ToolView = ReturnType<typeof sanitizeTool>;

/** Shared by the tool, upvote and ranking services — validates then 404s. */
export const findToolOrThrow = async (toolId: string): Promise<ToolDocument> => {
  const tool = await Tool.findById(toObjectId(toolId));

  if (!tool) {
    throw notFound(ERROR_MESSAGE.TOOL_NOT_FOUND, ErrorCode.TOOL_NOT_FOUND);
  }

  return tool;
};

export const createTool = async (userId: string, input: CreateToolInput) => {
  const linkKey = normalizeLink(input.link);

  // Checked up front so the caller gets a precise message rather than a generic
  // duplicate-key conflict. The catch below still closes the race between two
  // simultaneous submissions of the same tool — the unique index is the real
  // guarantee, this is just the good error message.
  if (await Tool.exists({ linkKey })) {
    throw conflict(ERROR_MESSAGE.TOOL_ALREADY_EXISTS, ErrorCode.TOOL_ALREADY_EXISTS);
  }

  try {
    const tool = await Tool.create({
      name: input.name,
      description: input.description,
      category: input.category,
      link: input.link,
      linkKey,
      tags: normalizeTags(input.tags),
      // Derived here, never taken from the request — otherwise a submitter
      // could stuff keywords and surface in every related list on the site.
      keywords: extractKeywords(input.name, input.description),
      submittedBy: toObjectId(userId),
      upvoteCount: 0,
    });

    return sanitizeTool(tool);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw conflict(ERROR_MESSAGE.TOOL_ALREADY_EXISTS, ErrorCode.TOOL_ALREADY_EXISTS);
    }

    throw err;
  }
};

const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

export const listTools = async ({ page, limit, category, search }: ListToolsQuery) => {
  const filter: QueryFilter<ToolDocument> = {};

  if (category) filter.category = category;

  if (search) {
    // Escaped first — an unescaped "c++" or "(" would either throw as an
    // invalid pattern or quietly match the wrong documents.
    const pattern = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }, { tags: pattern }];
  }

  const [tools, total] = await Promise.all([
    Tool.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Tool.countDocuments(filter),
  ]);

  return { tools: tools.map(sanitizeTool), pagination: paginate(page, limit, total) };
};

/**
 * Recently added tools — newest first, straight off the `{ createdAt: -1 }`
 * index. No scoring: "recent" must be a pure, obvious ordering, so a tool that
 * was just submitted is visibly at the top.
 */
export const getRecentTools = async (page: number, limit: number) => {
  const [tools, total] = await Promise.all([
    Tool.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Tool.estimatedDocumentCount(),
  ]);

  return { tools: tools.map(sanitizeTool), pagination: paginate(page, limit, total) };
};

export const getToolById = async (toolId: string) => sanitizeTool(await findToolOrThrow(toolId));
