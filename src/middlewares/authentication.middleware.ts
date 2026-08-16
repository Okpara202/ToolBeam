import { JWT_ACCESS_SECRET } from '@/config/env.config';
import { ErrorCode } from '@/constants/error-code';
import { ERROR_MESSAGE } from '@/constants/message';
import { unauthorized } from '@/errors/AppError';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(unauthorized(ERROR_MESSAGE.NO_TOKEN_PROVIDED, ErrorCode.NO_TOKEN_PROVIDED));
  }

  try {
    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;

    req.user = { id: decoded.id, email: decoded.email };

    next();
  } catch {
    // Deliberately one response for malformed, tampered and expired tokens
    // alike — distinguishing them tells an attacker which half of a forgery
    // attempt was wrong.
    next(unauthorized(ERROR_MESSAGE.INVALID_EXPIRED_TOKEN, ErrorCode.INVALID_EXPIRED_TOKEN));
  }
};
