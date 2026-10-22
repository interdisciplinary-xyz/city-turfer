import { z } from '@hono/zod-openapi';

import { IsoDateTime } from './common';

/**
 * Identity: sign-in with an e-mailed one-time code (Better Auth), the session and the user. A user
 * signed in with a device token (API_TOKENS, one more release) has no e-mail.
 */

export const Email = z
  .email()
  .max(254)
  .openapi({ description: 'Compared in lower case.', example: 'ania@example.com' });

export const User = z
  .object({
    id: z.string().openapi({ example: 'u_7Hq2kX9mPz' }),
    email: Email.nullable().openapi({ description: 'Null for device-token users.' }),
    displayName: z.string().openapi({ description: 'Falls back to the user id.', example: 'u_7Hq2kX9mPz' }),
    createdAt: IsoDateTime.openapi({ description: 'When the server first saw the account.' }),
  })
  .openapi('User');

export const RequestCodeBody = z.object({ email: Email }).openapi('RequestCodeBody');

export const CodeRequested = z
  .object({})
  .openapi('CodeRequested', { description: 'Empty: the same answer whether or not the e-mail has an account.' });

export const SignInBody = z
  .object({
    email: Email,
    code: z
      .string()
      .min(1)
      .max(16)
      .openapi({ description: 'The 6-digit code from the e-mail (works once, 10 minutes).', example: '493027' }),
  })
  .openapi('SignInBody');

export const Session = z
  .object({
    token: z.string().openapi({
      description: 'Bearer token: send `Authorization: Bearer <token>`. Store it in the keychain; never log it.',
      example: 'q8VbXf3T2LwN0aZr5sJyK1mHcP7dUe4G',
    }),
    expiresAt: IsoDateTime.openapi({
      description: 'About 60 days ahead; using the session after a day moves it 60 days on (sliding).',
    }),
    user: z
      .object({
        id: z.string().openapi({ example: 'u_7Hq2kX9mPz' }),
        email: Email,
      })
      .openapi('SessionUser'),
  })
  .openapi('Session');
