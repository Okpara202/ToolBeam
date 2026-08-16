import { NODE_ENV } from '@/config/env.config';
import { NodeEnv } from '@/constants';
import pino from 'pino';
import type { Options } from 'pino-http';

const isDevelopment = NODE_ENV === NodeEnv.DEVELOPMENT;

const logger = pino({
  level: NODE_ENV === NodeEnv.TEST ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

export const httpLoggerConfig: Options = {
  logger,
  // Health checks and the docs UI would otherwise drown out real traffic.
  autoLogging: {
    ignore: (req) => req.url === '/health' || (req.url?.startsWith('/docs') ?? false),
  },
};

export default logger;
