import { z } from '@/lib/zod';

const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .openapi({ example: 'demo@toolbeam.dev' });

const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z
  .object({
    name: z
      .string({ error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name cannot exceed 60 characters')
      .openapi({ example: 'Ada Lovelace' }),
    email: emailSchema,
    password: passwordSchema.openapi({ example: 'Toolbeam123!' }),
  })
  .openapi('RegisterInput');

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    // No strength rules on login — the requirements are enforced at
    // registration, and applying them here would leak which stored passwords
    // predate a future policy change.
    password: z.string({ error: 'Password is required' }).openapi({ example: 'Toolbeam123!' }),
  })
  .openapi('LoginInput');

export type LoginInput = z.infer<typeof loginSchema>;
