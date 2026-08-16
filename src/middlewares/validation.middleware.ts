import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError, type ZodType } from 'zod';

const formatPath = (path: readonly PropertyKey[]) =>
  path.length
    ? path
        .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
        .join('.')
    : 'error';

/**
 * Parses `req.body` or `req.query` against a Zod schema and replaces it with the
 * parsed result, so handlers downstream receive coerced, defaulted, typed data.
 *
 * Validation failures are answered here rather than forwarded to the error
 * handler, because they need a different response shape: a field-keyed map,
 * so a client can attach each message to the input that caused it.
 */
export const validateSchema = (schema: ZodType, source: 'body' | 'query' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(source === 'body' ? req.body : req.query);

      if (source === 'body') {
        req.body = parsed;
      } else {
        // req.query is getter-only in Express 5 — see types/express.d.ts.
        req.validatedQuery = parsed as Record<string, unknown>;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.reduce<Record<string, string>>((acc, issue) => {
          acc[formatPath(issue.path)] = issue.message;
          return acc;
        }, {});

        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ success: false, errors });
        return;
      }

      next(err);
    }
  };
};
