import { z } from '@/lib/zod';

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      message: z.string().openapi({ example: 'Tool not found' }),
      code: z.string().openapi({ example: 'TOOL_NOT_FOUND' }),
    }),
  })
  .openapi('ErrorResponse');

export const validationErrorResponseSchema = z
  .object({
    success: z.literal(false),
    // Field-keyed so a client can attach each message to the input that caused it.
    errors: z.record(z.string(), z.string()).openapi({
      example: { description: 'Description must be at least 20 characters' },
    }),
  })
  .openapi('ValidationErrorResponse');

export const paginationSchema = z
  .object({
    page: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 10 }),
    total: z.number().openapi({ example: 36 }),
    totalPages: z.number().openapi({ example: 4 }),
  })
  .openapi('Pagination');

export const successResponseSchema = <T extends z.ZodTypeAny>(name: string, dataSchema: T) =>
  z.object({ success: z.literal(true), message: z.string(), data: dataSchema }).openapi(name);

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(name: string, itemSchema: T) =>
  z
    .object({
      success: z.literal(true),
      message: z.string(),
      data: z.array(itemSchema),
      pagination: paginationSchema,
    })
    .openapi(name);

/** Response blocks that repeat on nearly every path. */
export const commonResponses = {
  unauthorized: {
    description: 'Missing, malformed or expired bearer token',
    content: { 'application/json': { schema: errorResponseSchema } },
  },
  validation: {
    description: 'Request failed schema validation',
    content: { 'application/json': { schema: validationErrorResponseSchema } },
  },
  notFound: {
    description: 'Resource not found',
    content: { 'application/json': { schema: errorResponseSchema } },
  },
  badRequest: {
    description: 'Malformed id',
    content: { 'application/json': { schema: errorResponseSchema } },
  },
  conflict: {
    description: 'Conflicts with the current state of the resource',
    content: { 'application/json': { schema: errorResponseSchema } },
  },
} as const;

export const bearerAuth = [{ bearerAuth: [] }];
