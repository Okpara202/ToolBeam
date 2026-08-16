import { JWT_ACCESS_EXPIRES_IN, JWT_ACCESS_SECRET } from '@/config/env.config';
import { ErrorCode } from '@/constants/error-code';
import { ERROR_MESSAGE } from '@/constants/message';
import User, { type UserDocument } from '@/db/models/user.model';
import { conflict, notFound, unauthorized } from '@/errors/AppError';
import type { JwtPayload } from '@/middlewares/authentication.middleware';
import { hashPassword, verifyPassword } from '@/utils/helper.util';
import { toObjectId } from '@/utils/mongo.util';
import type { LoginInput, RegisterInput } from '@/validations/auth.validation';
import jwt, { type SignOptions } from 'jsonwebtoken';

const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN } as SignOptions);

const sanitizeUser = (user: UserDocument) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

export const register = async (input: RegisterInput) => {
  const existing = await User.findOne({ email: input.email });

  if (existing) {
    throw conflict(ERROR_MESSAGE.EMAIL_ALREADY_REGISTERED, ErrorCode.EMAIL_ALREADY_REGISTERED);
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: await hashPassword(input.password),
  });

  // Returning a token straight from register saves the client a second round
  // trip, and lets the demo submit a tool immediately after signing up.
  return {
    user: sanitizeUser(user),
    token: signAccessToken({ id: user._id.toString(), email: user.email }),
  };
};

export const login = async (input: LoginInput) => {
  // `password` is `select: false` on the schema, so it has to be asked for.
  const user = await User.findOne({ email: input.email }).select('+password');

  // One message for "no such account" and "wrong password" alike — separate
  // responses would turn this endpoint into an account-enumeration oracle.
  if (!user || !(await verifyPassword(user.password, input.password))) {
    throw unauthorized(ERROR_MESSAGE.INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
  }

  return {
    user: sanitizeUser(user),
    token: signAccessToken({ id: user._id.toString(), email: user.email }),
  };
};

export const getProfile = async (userId: string) => {
  const user = await User.findById(toObjectId(userId));

  if (!user) {
    throw notFound(ERROR_MESSAGE.USER_NOT_FOUND, ErrorCode.USER_NOT_FOUND);
  }

  return sanitizeUser(user);
};
