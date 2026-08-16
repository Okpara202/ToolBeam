import { CATEGORIES, Category } from '@/constants/category';
import { registry } from '@/lib/open-api-registry';
import {
  bearerAuth,
  commonResponses,
  paginatedResponseSchema,
  successResponseSchema,
} from '@/lib/response.docs';
import { z } from '@/lib/zod';
import {
  createToolSchema,
  listToolsQuerySchema,
  popularToolsQuerySchema,
  recentToolsQuerySchema,
  relatedToolsQuerySchema,
} from '@/validations/tool.validation';

const toolSchema = z
  .object({
    id: z.string().openapi({ example: '6a60b8659c16fbcbeab13e49' }),
    name: z.string().openapi({ example: 'Perplexity' }),
    description: z.string().openapi({
      example: 'An answer engine that searches the web in real time and returns cited answers.',
    }),
    category: z.enum(CATEGORIES as [Category, ...Category[]]).openapi({ example: Category.RESEARCH }),
    link: z.string().openapi({ example: 'https://www.perplexity.ai' }),
    tags: z.array(z.string()).openapi({ example: ['search', 'citations', 'answer-engine'] }),
    submittedBy: z.string().openapi({ example: '6a60b6659c16fbcbeab13e48' }),
    upvoteCount: z.number().openapi({ example: 42 }),
    createdAt: z.string().openapi({ example: '2026-08-16T10:46:15.836Z' }),
    updatedAt: z.string().openapi({ example: '2026-08-16T10:46:15.836Z' }),
  })
  .openapi('Tool');

const popularToolSchema = toolSchema
  .extend({
    popularityScore: z.number().openapi({
      example: 0.094371,
      description:
        'upvoteCount / (ageHours + 2)^1.5 — computed at query time, never stored. For a windowed request this is the number of upvotes cast inside the window.',
    }),
    ageHours: z
      .number()
      .optional()
      .openapi({ example: 72.4, description: 'Age of the tool at query time. All-time ranking only.' }),
    windowUpvotes: z
      .number()
      .optional()
      .openapi({ example: 18, description: 'Upvotes cast inside the window. Windowed ranking only.' }),
  })
  .openapi('PopularTool');

const relatedToolSchema = toolSchema
  .extend({
    relevanceScore: z.number().openapi({
      example: 7.5,
      description:
        '3 x same category + 2 x shared tags + 1 x shared keywords + 0.5 x normalized popularity. Zero for a backfilled result.',
    }),
    matchedOn: z
      .object({
        sameCategory: z.boolean().openapi({ example: true }),
        sharedTags: z.array(z.string()).openapi({ example: ['search', 'citations'] }),
        sharedKeywords: z.array(z.string()).openapi({ example: ['answers', 'sources'] }),
      })
      .openapi({ description: 'Why this tool matched — the score broken back down into its parts.' }),
  })
  .openapi('RelatedTool');

const toolResponseSchema = successResponseSchema('ToolResponse', toolSchema);
const toolListResponseSchema = paginatedResponseSchema('ToolListResponse', toolSchema);

const popularToolsResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    window: z.string().openapi({ example: 'all' }),
    data: z.array(popularToolSchema),
  })
  .openapi('PopularToolsResponse');

const relatedToolsResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    source: z
      .object({
        id: z.string().openapi({ example: '6a60b8659c16fbcbeab13e49' }),
        name: z.string().openapi({ example: 'Perplexity' }),
        category: z.string().openapi({ example: Category.RESEARCH }),
        tags: z.array(z.string()).openapi({ example: ['search', 'citations'] }),
      })
      .openapi({ description: 'The tool the results were matched against.' }),
    data: z.array(relatedToolSchema),
  })
  .openapi('RelatedToolsResponse');

const upvoteResponseSchema = successResponseSchema(
  'UpvoteResponse',
  z
    .object({
      id: z.string().openapi({ example: '6a60b8659c16fbcbeab13e49' }),
      name: z.string().openapi({ example: 'Perplexity' }),
      upvoteCount: z.number().openapi({ example: 43 }),
      hasUpvoted: z.boolean().openapi({ example: true }),
    })
    .openapi('UpvoteResult'),
);

const categoriesResponseSchema = successResponseSchema(
  'CategoriesResponse',
  z.array(
    z
      .object({
        value: z.string().openapi({ example: Category.RESEARCH }),
        label: z.string().openapi({ example: 'Research' }),
      })
      .openapi('CategoryOption'),
  ),
);

const idParam = z.object({
  id: z.string().openapi({ example: '6a60b8659c16fbcbeab13e49', description: 'Tool id' }),
});

export const registerToolDocs = () => {
  registry.registerPath({
    method: 'post',
    path: '/api/v1/tools',
    tags: ['Tools'],
    summary: 'Submit a new AI tool',
    description:
      'Duplicate submissions are rejected by comparing a normalized form of the link, so protocol, "www." and trailing-slash differences all resolve to the same tool.',
    security: bearerAuth,
    request: { body: { content: { 'application/json': { schema: createToolSchema } } } },
    responses: {
      '201': {
        description: 'Tool submitted',
        content: { 'application/json': { schema: toolResponseSchema } },
      },
      '401': commonResponses.unauthorized,
      '409': {
        description: 'A tool with this link already exists',
        content: { 'application/json': { schema: commonResponses.conflict.content['application/json'].schema } },
      },
      '422': commonResponses.validation,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/tools',
    tags: ['Tools'],
    summary: 'Browse all tools',
    description: 'Newest first, with optional category filter and free-text search.',
    request: { query: listToolsQuerySchema },
    responses: {
      '200': {
        description: 'Tools',
        content: { 'application/json': { schema: toolListResponseSchema } },
      },
      '422': commonResponses.validation,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/tools/recent',
    tags: ['Discovery'],
    summary: 'Most recently added tools',
    description:
      'A pure `createdAt` ordering off a dedicated index — no scoring, so a tool submitted a second ago is visibly first.',
    request: { query: recentToolsQuerySchema },
    responses: {
      '200': {
        description: 'Recently added tools, newest first',
        content: { 'application/json': { schema: toolListResponseSchema } },
      },
      '422': commonResponses.validation,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/tools/popular',
    tags: ['Discovery'],
    summary: 'Most popular tools',
    description: [
      'Popularity is upvotes discounted by age, so recent momentum outranks an old accumulated total:',
      '',
      '    score = upvoteCount / (ageHours + 2)^1.5',
      '',
      'The `upvotes` collection is the source of truth (one document per user per tool, unique-indexed).',
      '`tools.upvoteCount` is a denormalized counter kept by an atomic `$inc`. The score itself is never',
      'stored — it changes every second as tools age, so it is computed at read time against `$$NOW`.',
      '',
      'Pass `window=week` or `window=month` for a trending view, which ranks by upvotes cast inside that',
      'window with no age decay applied.',
    ].join('\n'),
    request: { query: popularToolsQuerySchema },
    responses: {
      '200': {
        description: 'Popular tools, highest score first',
        content: { 'application/json': { schema: popularToolsResponseSchema } },
      },
      '422': commonResponses.validation,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/tools/{id}',
    tags: ['Tools'],
    summary: 'Fetch a single tool',
    request: { params: idParam },
    responses: {
      '200': {
        description: 'Tool',
        content: { 'application/json': { schema: toolResponseSchema } },
      },
      '400': commonResponses.badRequest,
      '404': commonResponses.notFound,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/tools/{id}/related',
    tags: ['Discovery'],
    summary: 'Tools related to a specific tool',
    description: [
      'Content-based relatedness, scored over three overlapping attribute sets and tie-broken by popularity:',
      '',
      '    score = 3 x (same category) + 2 x |shared tags| + 1 x |shared keywords| + 0.5 x normalized upvotes',
      '',
      '`keywords` are derived from the name and description on write, which makes free-text similarity the',
      'same cheap array intersection as tag overlap — no text index, no second query.',
      '',
      'This works for a tool submitted seconds ago with zero upvotes, and the response never comes back',
      'empty: if too few tools genuinely match, the tail is backfilled with popular tools carrying',
      '`relevanceScore: 0`.',
    ].join('\n'),
    request: { params: idParam, query: relatedToolsQuerySchema },
    responses: {
      '200': {
        description: 'Related tools, most relevant first',
        content: { 'application/json': { schema: relatedToolsResponseSchema } },
      },
      '400': commonResponses.badRequest,
      '404': commonResponses.notFound,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/tools/{id}/upvote',
    tags: ['Tools'],
    summary: 'Upvote a tool',
    description:
      'One upvote per user per tool, enforced by a unique index on the upvotes collection rather than by an application-level check — so concurrent requests cannot both slip through. A repeat upvote returns 409.',
    security: bearerAuth,
    request: { params: idParam },
    responses: {
      '200': {
        description: 'Upvote recorded',
        content: { 'application/json': { schema: upvoteResponseSchema } },
      },
      '400': commonResponses.badRequest,
      '401': commonResponses.unauthorized,
      '404': commonResponses.notFound,
      '409': {
        description: 'You have already upvoted this tool',
        content: { 'application/json': { schema: commonResponses.conflict.content['application/json'].schema } },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/tools/{id}/upvote',
    tags: ['Tools'],
    summary: 'Remove your upvote from a tool',
    security: bearerAuth,
    request: { params: idParam },
    responses: {
      '200': {
        description: 'Upvote removed',
        content: { 'application/json': { schema: upvoteResponseSchema } },
      },
      '400': commonResponses.badRequest,
      '401': commonResponses.unauthorized,
      '404': commonResponses.notFound,
      '409': {
        description: 'You have not upvoted this tool',
        content: { 'application/json': { schema: commonResponses.conflict.content['application/json'].schema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/categories',
    tags: ['Tools'],
    summary: 'List the category taxonomy',
    responses: {
      '200': {
        description: 'Categories',
        content: { 'application/json': { schema: categoriesResponseSchema } },
      },
    },
  });
};
