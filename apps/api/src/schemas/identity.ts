import { z } from '@hono/zod-openapi';

import { MAX_PASSWORD_UNITS } from '../identity/better-auth';
import { IsoDateTime } from './common';

/**
 * Identity: sign-in with an e-mailed one-time code or an optional password (Better Auth), the session,
 * the user and the account settings (contract 0.5.0). A user signed in with a device token
 * (API_TOKENS, one more release) has no e-mail and cannot change account settings.
 */

export const Email = z
  .email()
  .max(254)
  .openapi({ description: 'Compared in lower case.', example: 'ania@example.com' });

export const User = z
  .object({
    id: z.string().openapi({ example: 'u_7Hq2kX9mPz' }),
    email: Email.nullable().openapi({ description: 'Null for device-token users.' }),
    name: z.string().nullable().openapi({
      description: 'The name the Turfer chose (at most 40 characters); null when none: show "You", never the id.',
      example: 'Ania',
    }),
    displayName: z.string().openapi({
      description: 'Deprecated since 0.5.0 (old phone builds): `name`, falling back to the user id. Read `name`.',
      deprecated: true,
      example: 'Ania',
    }),
    hasPassword: z.boolean().openapi({ description: 'Whether the account can also sign in with a password.' }),
    passwordChangedAt: IsoDateTime.nullable().openapi({ description: 'When the password was set or last changed.' }),
    createdAt: IsoDateTime.openapi({ description: 'When the server first saw the account.' }),
  })
  .openapi('User');

/** A 6-digit code from an e-mail (trimmed; checked by the use case). */
const Code = (description: string) => z.string().min(1).max(16).openapi({ description, example: '493027' });

/**
 * An e-mail as typed: the core rule (`newEmail`) answers `422 email.invalid`, not a 400. That rule
 * accepts exactly what `Email` (`z.email()`, the sign-in routes) accepts, after trimming, so an
 * account can never move to an address it cannot sign in with (pinned by account.test.ts).
 */
const NewEmail = z
  .string()
  .min(1)
  .max(254)
  .openapi({ description: 'Compared in lower case.', example: 'ania@example.com' });

/** A password as typed: not trimmed; the core rule counts code points (12 to 128). */
const Password = (description: string) =>
  z.string().min(1).max(MAX_PASSWORD_UNITS).openapi({ description, example: 'tram stops past the old town' });

export const RequestCodeBody = z.object({ email: Email }).openapi('RequestCodeBody');

export const CodeRequested = z
  .object({})
  .openapi('CodeRequested', { description: 'Empty: the same answer whether or not the e-mail has an account.' });

export const SessionClient = z.enum(['phone', 'browser']).openapi('SessionClient', {
  description: '`phone`: the app, with a bearer token. `browser`: the website, with the session cookie.',
  example: 'browser',
});

/** How the new session lives; the same for a code and a password sign-in. */
const SignInClient = {
  client: SessionClient.optional().openapi({
    description:
      'Default `phone`: the token comes in the body. `browser`: the session goes in the `__Host-ct_session` cookie and the body has no token; the request must come from the website (`Origin`, `CityTurfer-Client: web/<version>`, else `403 auth.csrf`).',
    example: 'browser',
  }),
  sharedComputer: z.boolean().optional().openapi({
    description:
      'Browsers only ("This is a shared computer"): the cookie lasts until the browser closes and the session at most 8 hours. `true` with a phone is `400`.',
    example: false,
  }),
};

const browserOnly = (b: { client?: 'phone' | 'browser'; sharedComputer?: boolean }) =>
  !b.sharedComputer || b.client === 'browser';

export const CodeSignInBody = z
  .object({
    email: Email,
    code: Code('The 6-digit code from the e-mail (works once, 10 minutes).'),
    ...SignInClient,
  })
  .refine(browserOnly, { path: ['sharedComputer'] })
  .openapi('CodeSignInBody');

export const PasswordSignInBody = z
  .object({
    email: Email,
    password: Password('The account password (sign-in only: accounts are created by a code).'),
    ...SignInClient,
  })
  .refine(browserOnly, { path: ['sharedComputer'] })
  .openapi('PasswordSignInBody');

export const SignInBody = z.union([CodeSignInBody, PasswordSignInBody]).openapi('SignInBody', {
  description: 'Either the e-mailed code or the account password, for a phone or a browser session.',
});

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
      description:
        'Last use, to the day: a session records its use at most once a day (also once its expiry can no longer move). A shared-computer session (8 hours) shows when it signed in.',
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

export const UpdateMeBody = z
  .object({
    // The 1000 cap only bounds the body; the core rule (40 characters) answers 422 below it.
    name: z.string().max(1000).openapi({
      description: 'Trimmed, at most 40 characters, no control characters; blank clears it.',
      example: 'Ania',
    }),
  })
  .openapi('UpdateMeBody');

export const EmailChangeCodeBody = z
  .object({
    newEmail: NewEmail,
    stepUpCode: Code('The code from `POST /v1/me/step-up/codes` (spent here).'),
  })
  .openapi('EmailChangeCodeBody');

export const ChangeEmailBody = z
  .object({
    newEmail: NewEmail,
    code: Code('The code mailed to the new address.'),
  })
  .openapi('ChangeEmailBody');

export const SetPasswordBody = z
  .object({
    newPassword: Password('12 to 128 characters, any characters, spaces count; not in a known data breach.'),
    stepUpCode: Code('The code from `POST /v1/me/step-up/codes` (spent here).'),
  })
  .openapi('SetPasswordBody');

export const RemovePasswordBody = z
  .object({ stepUpCode: Code('The code from `POST /v1/me/step-up/codes` (spent here).') })
  .openapi('RemovePasswordBody');
