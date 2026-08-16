import { registry } from '@/lib/open-api-registry';
import {
  bearerAuth,
  commonResponses,
  successResponseSchema,
} from '@/lib/response.docs';
import { z } from '@/lib/zod';
import { loginSchema, registerSchema } from '@/validations/auth.validation';

const userSchema = z
  .object({
    id: z.string().openapi({ example: '6a60b8659c16fbcbeab13e49' }),
    name: z.string().openapi({ example: 'Ada Lovelace' }),
    email: z.string().openapi({ example: 'demo@toolbeam.dev' }),
    createdAt: z.string().openapi({ example: '2026-08-16T10:46:15.836Z' }),
  })
  .openapi('User');

const authPayloadSchema = z
  .object({
    user: userSchema,
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
  })
  .openapi('AuthPayload');

const authResponseSchema = successResponseSchema('AuthResponse', authPayloadSchema);
const profileResponseSchema = successResponseSchema('ProfileResponse', userSchema);

export const registerAuthDocs = () => {
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    tags: ['Auth'],
    summary: 'Create an account and receive an access token',
    description:
      'Returns a token immediately so a new user can submit a tool without a second round trip.',
    request: {
      body: { content: { 'application/json': { schema: registerSchema } } },
    },
    responses: {
      '201': {
        description: 'Account created',
        content: { 'application/json': { schema: authResponseSchema } },
      },
      '409': {
        description: 'Email already registered',
        content: { 'application/json': { schema: commonResponses.conflict.content['application/json'].schema } },
      },
      '422': commonResponses.validation,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['Auth'],
    summary: 'Log in and receive an access token',
    request: {
      body: { content: { 'application/json': { schema: loginSchema } } },
    },
    responses: {
      '200': {
        description: 'Logged in',
        content: { 'application/json': { schema: authResponseSchema } },
      },
      '401': {
        description: 'Invalid email or password',
        content: { 'application/json': { schema: commonResponses.unauthorized.content['application/json'].schema } },
      },
      '422': commonResponses.validation,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    tags: ['Auth'],
    summary: 'Fetch the logged-in user',
    security: bearerAuth,
    responses: {
      '200': {
        description: 'Current user',
        content: { 'application/json': { schema: profileResponseSchema } },
      },
      '401': commonResponses.unauthorized,
    },
  });
};
