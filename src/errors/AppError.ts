import { ErrorCode } from '@/constants/error-code';
import { StatusCodes } from 'http-status-codes';

/**
 * An error the API raised on purpose, with a status code and a stable machine
 * -readable `code` for clients to branch on.
 *
 * The `isOperational` flag is what lets the error handler tell "the user asked
 * for a tool that does not exist" apart from "a driver blew up" — the first is
 * safe to echo back verbatim, the second must be masked.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational = true;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = ErrorCode.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;

    Error.captureStackTrace(this, AppError);
  }
}

export const badRequest = (message: string, code = ErrorCode.VALIDATION_ERROR) =>
  new AppError(message, StatusCodes.BAD_REQUEST, code);

export const unauthorized = (message: string, code = ErrorCode.UNAUTHORIZED) =>
  new AppError(message, StatusCodes.UNAUTHORIZED, code);

export const notFound = (message: string, code = ErrorCode.RESOURCE_NOT_FOUND) =>
  new AppError(message, StatusCodes.NOT_FOUND, code);

export const conflict = (message: string, code = ErrorCode.DUPLICATE_ENTRY) =>
  new AppError(message, StatusCodes.CONFLICT, code);

export default AppError;
