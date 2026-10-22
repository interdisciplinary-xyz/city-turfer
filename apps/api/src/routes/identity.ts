import type { OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { AppEnv } from '../deps';
import { problem } from '../problem';
import { AUTH_ERRORS, INVALID, problemResponse, UNAVAILABLE } from '../schemas/common';
import { CodeRequested, RequestCodeBody, Session, SignInBody, User } from '../schemas/identity';
import { defineRoute, valid } from './define';
import { iso, userDto } from './dto';

const TAG = ['Identity'];
const json = <T>(schema: T) => ({ 'application/json': { schema } });

const RATE_LIMITED = {
  429: {
    ...problemResponse('Too many codes or sign-ins: wait `Retry-After` seconds.', 'auth.rate-limited'),
    headers: { 'Retry-After': { $ref: '#/components/headers/RetryAfter' } },
  },
} as const;

/**
 * The caller's IP as Vercel reports it (`x-real-ip`, else the first `x-forwarded-for`; Vercel sets
 * both). Never logged. IdentityService buckets it (IPv6 by /64). Without either header (the local
 * dev server) every caller shares the `unknown` bucket of the per-IP limits — fine locally; on
 * Vercel the header is always present.
 */
function clientIp(c: Context<AppEnv>): string {
  return c.req.header('x-real-ip')?.trim() || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** Identity: e-mail codes, sign-in, sign-out, the current user (use cases in src/identity/). */
export function registerIdentity(app: OpenAPIHono<AppEnv>): void {
  defineRoute(
    app,
    {
      status: 'live',
      method: 'post',
      path: '/v1/auth/codes',
      tags: TAG,
      operationId: 'requestSignInCode',
      security: [],
      summary: 'E-mail me a sign-in code',
      description:
        'Sends a 6-digit one-time code (valid 10 minutes) to the address (use case RequestSignInCode). Always `202 {}`, also for an address without an account: the account is created by the first successful sign-in. Limits: 1 code per address per minute, 3 per 10 minutes and 10 per day, 30 per IP (an IPv6 /64 counts as one IP) per 10 minutes (`429 auth.rate-limited` with `Retry-After`). While a code is still valid and not burnt, a new request mails the same code again (and extends it by 10 minutes) instead of replacing it.',
      request: { body: { required: true, content: json(RequestCodeBody) } },
      responses: {
        202: { description: 'Code sent if the address can receive it.', content: json(CodeRequested) },
        ...INVALID,
        ...RATE_LIMITED,
        ...UNAVAILABLE,
      },
    },
    async (c) => {
      const { identity } = c.var.deps;
      if (!identity) {
        return problem(c, 'storage.unavailable', 'Sign-in is not configured on this server.');
      }
      const body = valid<z.infer<typeof RequestCodeBody>>(c, 'json');
      await identity.requestCode(body.email.toLowerCase(), clientIp(c));
      return c.json({}, 202);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'post',
      path: '/v1/auth/sign-in',
      tags: TAG,
      operationId: 'signIn',
      security: [],
      summary: 'Sign in with the code',
      description:
        'Exchanges the e-mailed code for a bearer session of about 60 days, sliding (use case SignIn; Better Auth). Creates the account on the first sign-in. A wrong or expired code is `401 auth.invalid-code`; three wrong tries burn the code (ask for a new one). Limits: 10 sign-ins per address and 20 failed sign-ins per IP (an IPv6 /64 counts as one IP) per 10 minutes, and 10 failed sign-ins per address per day (then even the right code answers `429` until the day is over).',
      request: { body: { required: true, content: json(SignInBody) } },
      responses: {
        200: { description: 'Signed in.', content: json(Session) },
        ...INVALID,
        401: problemResponse('Wrong, expired or used-up code.', 'auth.invalid-code'),
        ...RATE_LIMITED,
        ...UNAVAILABLE,
      },
    },
    async (c) => {
      const { identity } = c.var.deps;
      if (!identity) {
        return problem(c, 'storage.unavailable', 'Sign-in is not configured on this server.');
      }
      const body = valid<z.infer<typeof SignInBody>>(c, 'json');
      const session = await identity.signIn(body.email.toLowerCase(), body.code.trim(), clientIp(c));
      c.header('Cache-Control', 'no-store');
      return c.json({ ...session, expiresAt: iso(session.expiresAt) }, 200);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'delete',
      path: '/v1/auth/session',
      tags: TAG,
      operationId: 'signOut',
      summary: 'Sign out',
      description:
        'Revokes the session of this bearer token (use case SignOut); the token answers `401` afterwards. Idempotent. A device token cannot be revoked here (remove it from `API_TOKENS`): `204` all the same.',
      responses: { 204: { description: 'Signed out.' }, ...AUTH_ERRORS },
    },
    async (c) => {
      const { principal, deps } = c.var;
      if (principal.kind === 'session' && principal.sessionToken && deps.identity) {
        await deps.identity.signOut(principal.sessionToken);
      }
      return c.body(null, 204);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/me',
      tags: TAG,
      operationId: 'getMe',
      summary: 'Current user',
      description:
        'The user the bearer token belongs to (use case GetCurrentUser); the server row is created on the first authenticated request. Consents, export and erasure live under Privacy.',
      responses: {
        200: { description: 'The signed-in user.', content: json(User) },
        ...AUTH_ERRORS,
      },
    },
    async (c) => c.json(userDto(await c.var.backup.me(c.var.userId)), 200)
  );
}
