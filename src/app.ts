import { corsOptions } from '@/config/cors.config';
import { ENABLE_DOCS } from '@/config/env.config';
import { httpLoggerConfig } from '@/config/logger.config';
import { API_PREFIX } from '@/constants';
import { ErrorCode } from '@/constants/error-code';
import { AppError } from '@/errors/AppError';
import errorHandler from '@/middlewares/error-handler.middleware';
import router from '@/routes';
import type { CreateAppOptions } from '@/types';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import { pinoHttp } from 'pino-http';

export async function createApp(options: CreateAppOptions = {}) {
  const enableDocs = options.enableDocs ?? ENABLE_DOCS;
  const app = express();

  app.use(pinoHttp(httpLoggerConfig));
  // No file uploads anywhere in this API, so a small body cap is free defence
  // against someone posting a multi-megabyte tool description.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(
    helmet({
      // Swagger UI ships inline scripts and styles, which the default policy
      // blocks outright. Everything this server returns otherwise is JSON, so
      // there is no user-authored HTML for a CSP to protect.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors(corsOptions));
  app.use(compression());
  // Render (and any reverse proxy) forwards the real client IP in headers.
  app.set('trust proxy', true);

  app.get('/health', (_req, res) => {
    res.status(StatusCodes.OK).json({ status: 'ok', uptime: process.uptime() });
  });

  app.use(API_PREFIX, router);

  if (enableDocs) {
    // Imported lazily so a production deployment that turns docs off never
    // pays to load swagger-ui or build the spec.
    const swaggerUi = await import('swagger-ui-express');
    const { generateOpenApiSpec } = await import('@/lib/open-api');

    const spec = generateOpenApiSpec();

    app.get('/docs.json', (_req, res) => {
      res.status(StatusCodes.OK).json(spec);
    });

    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customSiteTitle: 'Toolbeam API',
        swaggerOptions: { persistAuthorization: true, docExpansion: 'list' },
      }),
    );
  }

  app.get('/', (_req, res) => {
    if (enableDocs) return res.redirect('/docs');

    res.status(StatusCodes.OK).json({
      name: 'Toolbeam API',
      description: 'Submit, upvote and discover AI tools by recency, popularity and relation.',
      base: API_PREFIX,
    });
  });

  app.use((req, _res, next) => {
    next(
      new AppError(
        `Cannot ${req.method} ${req.originalUrl}`,
        StatusCodes.NOT_FOUND,
        ErrorCode.NOT_FOUND,
      ),
    );
  });

  app.use(errorHandler);

  return app;
}
