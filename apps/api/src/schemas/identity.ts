import { z } from '@hono/zod-openapi';

/** Identity: the user and their session (mock `admin` account until Better Auth lands). */

export const User = z
  .object({
    id: z.string().openapi({ example: 'admin' }),
    email: z.string().email().openapi({ example: 'admin@cityturfer.com' }),
    displayName: z.string().openapi({ example: 'Admin' }),
  })
  .openapi('User');

export const SignInBody = z
  .object({
    email: z.string().email().openapi({ example: 'admin@cityturfer.com' }),
    password: z.string().min(1).openapi({ example: '••••••••' }),
  })
  .openapi('SignInBody');

export const Session = z
  .object({
    token: z.string().openapi({ description: 'Bearer token for the Authorization header.', example: 'ct_abc123' }),
    expiresAt: z.string().datetime().openapi({ example: '2026-11-19T07:12:00Z' }),
    user: User,
  })
  .openapi('Session');
