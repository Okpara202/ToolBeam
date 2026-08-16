import { createApp } from '@/app';
import { API_BASE_URL, ENABLE_DOCS, PORT, assertRequiredEnv } from '@/config/env.config';
import logger from '@/config/logger.config';
import { connectDB, disconnectDB } from '@/db';

async function bootstrap() {
  assertRequiredEnv();

  const app = await createApp();

  // Connect before listening, so the instance never accepts a request it has
  // no database to answer with.
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`Toolbeam API listening on port ${PORT}`);
    if (ENABLE_DOCS) logger.info(`Docs: ${API_BASE_URL}/docs`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down`);

    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start Toolbeam API');
  process.exit(1);
});
