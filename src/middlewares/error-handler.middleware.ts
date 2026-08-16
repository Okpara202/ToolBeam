import { NODE_ENV } from '@/config/env.config';
import { NodeEnv } from '@/constants';
import { ErrorCode } from '@/constants/error-code';
import { ERROR_MESSAGE } from '@/constants/message';
import { AppError } from '@/errors/AppError';
import type { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';

interface NormalizedError {
  statusCode: number;
  message: string;
  code: string;
}

const isProductionLike = () => NODE_ENV === NodeEnv.PRODUCTION || NODE_ENV === NodeEnv.STAGING;

/**
 * Maps whatever was thrown onto a status/message/code triple.
 *
 * Anything not recognised here is treated as a genuine bug: the client gets a
 * generic 500 message so an internal stack trace or driver string never leaks
 * out through the API.
 */
const normalize = (err: unknown): NormalizedError => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, code: err.code };
  }

  // A malformed ObjectId in a path param — the client's mistake, not ours.
  if (err instanceof mongoose.Error.CastError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      message: ERROR_MESSAGE.INVALID_ID,
      code: ErrorCode.INVALID_ID,
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      message: err.message,
      code: ErrorCode.VALIDATION_ERROR,
    };
  }

  // Unique index violation that a service did not already translate into a
  // domain-specific conflict.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    return {
      statusCode: StatusCodes.CONFLICT,
      message: 'That record already exists',
      code: ErrorCode.DUPLICATE_ENTRY,
    };
  }

  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: ERROR_MESSAGE.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_SERVER_ERROR,
  };
};

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { statusCode, message, code } = normalize(err);

  if (statusCode >= 500) {
    req.log?.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(!isProductionLike() && err instanceof Error && { stack: err.stack }),
    },
  });
};

export default errorHandler;
