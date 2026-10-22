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

/** An e-mail as typed: the core rule (`newEmail`) answers `422 email.invalid`, not a 400. */
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

export const CodeSignInBody = z
  .object({
    email: Email,
    code: Code('The 6-digit code from the e-mail (works once, 10 minutes).'),
  })
  .openapi('CodeSignInBody');

export const PasswordSignInBody = z
  .object({
    email: Email,
    password: Password('The account password (sign-in only: accounts are created by a code).'),
  })
  .openapi('PasswordSignInBody');

export const SignInBody = z.union([CodeSignInBody, PasswordSignInBody]).openapi('SignInBody', {
  description: 'Either the e-mailed code or the account password.',
});

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
