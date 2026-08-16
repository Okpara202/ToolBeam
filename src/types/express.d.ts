import type { AuthenticatedUser } from '@/types';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware once a bearer token checks out. */
      user?: AuthenticatedUser;

      /**
       * Express 5 makes `req.query` a lazily-computed getter with no setter, so
       * a validation middleware cannot write coerced/defaulted values back onto
       * it. Parsed query params land here instead and handlers read from here.
       */
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
