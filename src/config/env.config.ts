import dotenv from 'dotenv';

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const PORT = Number(process.env.PORT) || 8000;

export const DATABASE_URL = process.env.DATABASE_URL ?? '';

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'toolbeam_dev_access_secret';
export const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '7d';

export const API_BASE_URL = process.env.API_BASE_URL ?? `http://localhost:${PORT}`;
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '';

// Deliberately independent of NODE_ENV: the deployed instance exists so that
// anyone can open its Swagger UI and exercise the API without cloning the repo.
export const ENABLE_DOCS = (process.env.ENABLE_DOCS ?? 'true') === 'true';

export const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL ?? 'demo@toolbeam.dev';
export const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Toolbeam123!';

/**
 * Fail fast on a misconfigured deployment rather than booting a server that
 * cannot connect to its database or that signs tokens with a guessable secret.
 * Tests supply their own in-memory database URL, so they are exempt.
 */
export const assertRequiredEnv = () => {
  const missing: string[] = [];

  if (!DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_ACCESS_SECRET) missing.push('JWT_ACCESS_SECRET');

  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in.',
    );
  }
};
