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

export const SessionClient = z.enum(['phone', 'browser']).openapi('SessionClient', {
  description: '`phone`: the app, with a bearer token. `browser`: the website, with the session cookie.',
  example: 'browser',
});

export const SignInBody = z
  .object({
    email: Email,
    code: z
      .string()
      .min(1)
      .max(16)
      .openapi({ description: 'The 6-digit code from the e-mail (works once, 10 minutes).', example: '493027' }),
    client: SessionClient.optional().openapi({
      description:
        'Default `phone`: the token comes in the body. `browser`: the session goes in the `__Secure-ct_session` cookie and the body has no token; the request must come from the website (`Origin`, `CityTurfer-Client: web/<version>`, else `403 auth.csrf`).',
      example: 'browser',
    }),
    sharedComputer: z.boolean().optional().openapi({
      description:
        'Browsers only ("This is a shared computer"): the cookie lasts until the browser closes and the session at most 8 hours. `true` with a phone is `400`.',
      example: false,
    }),
  })
  .refine((b) => !b.sharedComputer || b.client === 'browser', { path: ['sharedComputer'] })
  .openapi('SignInBody');

export const Session = z
  .object({
    token: z.string().optional().openapi({
      description:
        'Phones only — absent for `client: "browser"` (the cookie carries it and page scripts never see it). Bearer token: send `Authorization: Bearer <token>`. Store it in the keychain; never log it.',
      example: 'q8VbXf3T2LwN0aZr5sJyK1mHcP7dUe4G',
    }),
    client: SessionClient,
    expiresAt: IsoDateTime.openapi({
      description:
        'Phones: about 60 days ahead, moved 60 days on when used after a day (sliding). Browsers: 14 days ahead, sliding the same way, never past `absoluteExpiresAt`.',
    }),
    absoluteExpiresAt: IsoDateTime.nullable().openapi({
      description:
        'Browsers: the session ends then however often it is used (30 days, or 8 hours on a shared computer). Null for phones.',
    }),
    user: z
      .object({
        id: z.string().openapi({ example: 'u_7Hq2kX9mPz' }),
        email: Email,
      })
      .openapi('SessionUser'),
  })
  .openapi('Session');

/** Opaque session ids: Better Auth's random row id, never the token or anything derived from it. */
export const SessionId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/)
  .openapi({ example: 'Xq3T9mPzL2vN8aKc5sJyR1hGdU4fWe7B' });

export const SessionIdParam = z.object({
  sessionId: SessionId.openapi({ param: { name: 'sessionId', in: 'path' } }),
});

export const SignedInDevice = z
  .object({
    id: SessionId,
    client: SessionClient,
    createdAt: IsoDateTime.openapi({ description: 'When it signed in.' }),
    lastActiveAt: IsoDateTime.openapi({
      description: 'Last use, to the day: a session records its use at most once a day.',
    }),
    expiresAt: IsoDateTime.openapi({ description: 'When it signs out by itself unless used again.' }),
    current: z.boolean().openapi({ description: 'The session of this request.' }),
  })
  .openapi('SignedInDevice', {
    description: 'One signed-in phone or browser. No IP address, user agent or location is stored.',
  });

export const SessionList = z
  .object({ sessions: z.array(SignedInDevice) })
  .openapi('SessionList', { description: 'Live sessions, most recently used first. Device tokens are not listed.' });

export const RevokeScopeQuery = z.object({
  scope: z.enum(['others', 'all']).openapi({
    param: { name: 'scope', in: 'query' },
    description: '`others`: every session but this one. `all`: every session, this one and every phone included.',
    example: 'others',
  }),
});
