import { CATEGORIES, Category } from '@/constants/category';
import { DEFAULT_LIMIT, MAX_LIMIT, PopularWindow } from '@/constants/ranking';
import { z } from '@/lib/zod';

const pageSchema = z.coerce
  .number({ error: 'Page must be a number' })
  .int('Page must be a whole number')
  .min(1, 'Page must be at least 1')
  .optional()
  .default(1)
  .openapi({ example: 1 });

const limitSchema = z.coerce
  .number({ error: 'Limit must be a number' })
  .int('Limit must be a whole number')
  .min(1, 'Limit must be at least 1')
  .max(MAX_LIMIT, `Limit cannot exceed ${MAX_LIMIT}`)
  .optional()
  .default(DEFAULT_LIMIT)
  .openapi({ example: DEFAULT_LIMIT });

export const createToolSchema = z
  .object({
    name: z
      .string({ error: 'Tool name is required' })
      .trim()
      .min(2, 'Tool name must be at least 2 characters')
      .max(80, 'Tool name cannot exceed 80 characters')
      .openapi({ example: 'Perplexity' }),
    description: z
      .string({ error: 'Description is required' })
      .trim()
      .min(20, 'Description must be at least 20 characters')
      .max(1000, 'Description cannot exceed 1000 characters')
      .openapi({
        example:
          'An answer engine that searches the web in real time and returns cited, sourced answers to research questions.',
      }),
    category: z
      .enum(CATEGORIES as [Category, ...Category[]], {
        error: `Category must be one of: ${CATEGORIES.join(', ')}`,
      })
      .openapi({ example: Category.RESEARCH }),
    link: z
      .string({ error: 'Link is required' })
      .trim()
      .url('Link must be a valid URL, including http:// or https://')
      .openapi({ example: 'https://www.perplexity.ai' }),
    // Optional but strongly encouraged: tags are the second-heaviest signal in
    // the relatedness score, so a tool submitted without them relies purely on
    // its category and derived keywords to be discoverable.
    tags: z
      .array(z.string().trim().min(1, 'Tags cannot be empty'))
      .max(10, 'A tool can have at most 10 tags')
      .optional()
      .default([])
      .openapi({ example: ['search', 'citations', 'answer-engine'] }),
  })
  .openapi('CreateToolInput');

export type CreateToolInput = z.infer<typeof createToolSchema>;

export const listToolsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    category: z
      .enum(CATEGORIES as [Category, ...Category[]])
      .optional()
      .openapi({ example: Category.RESEARCH }),
    search: z.string().trim().min(1, 'Search term cannot be empty').optional().openapi({
      example: 'image',
    }),
  })
  .openapi('ListToolsQuery');

export type ListToolsQuery = z.infer<typeof listToolsQuerySchema>;

export const recentToolsQuerySchema = z
  .object({ page: pageSchema, limit: limitSchema })
  .openapi('RecentToolsQuery');

export type RecentToolsQuery = z.infer<typeof recentToolsQuerySchema>;

export const popularToolsQuerySchema = z
  .object({
    limit: limitSchema,
    /**
     * `all` ranks every tool by lifetime upvotes decayed against the tool's own
     * age. `week`/`month` instead rank by upvotes *cast inside that window* —
     * a genuine "trending now" view rather than a decayed all-time one.
     */
    window: z
      .enum([PopularWindow.ALL, PopularWindow.WEEK, PopularWindow.MONTH])
      .optional()
      .default(PopularWindow.ALL)
      .openapi({ example: PopularWindow.ALL }),
  })
  .openapi('PopularToolsQuery');

export type PopularToolsQuery = z.infer<typeof popularToolsQuerySchema>;

export const relatedToolsQuerySchema = z
  .object({ limit: limitSchema })
  .openapi('RelatedToolsQuery');

export type RelatedToolsQuery = z.infer<typeof relatedToolsQuerySchema>;
