import { ErrorCode } from '@/constants/error-code';
import { ERROR_MESSAGE } from '@/constants/message';
import { badRequest } from '@/errors/AppError';
import { Types, isValidObjectId } from 'mongoose';

/**
 * Rejects a malformed id before it reaches the driver.
 *
 * Without this, `Tool.findById('recent')` throws a CastError that reads like an
 * internal failure; callers get a clear 400 instead.
 */
export const toObjectId = (id: string): Types.ObjectId => {
  if (!isValidObjectId(id)) {
    throw badRequest(ERROR_MESSAGE.INVALID_ID, ErrorCode.INVALID_ID);
  }

  return new Types.ObjectId(id);
};

/** True for MongoDB's E11000 unique-index violation. */
export const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
