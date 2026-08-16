import { SUCCESS_MESSAGE } from '@/constants/message';
import { getProfile, login, register } from '@/services/auth.service';
import type { LoginInput, RegisterInput } from '@/validations/auth.validation';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const registerHandler = async (
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
) => {
  const data = await register(req.body);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: SUCCESS_MESSAGE.REGISTERED,
    data,
  });
};

export const loginHandler = async (req: Request<unknown, unknown, LoginInput>, res: Response) => {
  const data = await login(req.body);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.LOGGED_IN,
    data,
  });
};

export const getProfileHandler = async (req: Request, res: Response) => {
  const data = await getProfile(req.user!.id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: SUCCESS_MESSAGE.PROFILE_FETCHED,
    data,
  });
};
