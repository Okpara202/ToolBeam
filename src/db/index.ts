import { DATABASE_URL } from '@/config/env.config';
import logger from '@/config/logger.config';
import mongoose from 'mongoose';

export const connectDB = async (uri: string = DATABASE_URL): Promise<void> => {
  if (!uri) {
    throw new Error('DATABASE_URL is not set — cannot connect to MongoDB');
  }

  // Surfaces a bad Atlas connection string or a missing IP allowlist entry in
  // seconds instead of hanging for the 30s driver default.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  logger.info('MongoDB connected');
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};
