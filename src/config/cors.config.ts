import { ALLOWED_ORIGIN } from '@/config/env.config';
import type { CorsOptions } from 'cors';

const allowlist = ALLOWED_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  // An empty allowlist means "reflect whatever origin asked" — convenient for
  // local development and for a public read-only directory API. Set
  // ALLOWED_ORIGIN in production to lock it down.
  origin: allowlist.length ? allowlist : true,
  credentials: true,
  optionsSuccessStatus: 204,
};
