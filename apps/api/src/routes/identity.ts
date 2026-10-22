import type { OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';

import type { AppEnv } from '../deps';
import { BROWSER_SESSION } from '../identity/better-auth';
import { clearSessionCookie, isFromWebsite } from '../middleware';
import { problem } from '../problem';
import { AUTH_ERRORS, INVALID, notFound, problemResponse, UNAVAILABLE } from '../schemas/common';
import {
  CodeRequested,
  RequestCodeBody,
  RevokeScopeQuery,
  Session,
  SessionIdParam,
  SessionList,
  SignInBody,
  User,
} from '../schemas/identity';
import { SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES } from '../session-cookie';
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
 * The caller's IP as Vercel reports it, for the per-IP sign-in limits; never logged or stored.
 * `x-vercel-forwarded-for` first: Vercel sets it, and unlike `x-forwarded-for` a proxy in front of
 * the function cannot replace it (the website's `/api/v1/*` rewrite is such a hop; whether the
 * visitor's IP survives it is checked on a preview, docs/operations/api-deploy.md). Then
 * `x-real-ip`, then the first `x-forwarded-for`. IdentityService buckets it (IPv6 by /64). Without
 * any (the local dev server) every caller shares the `unknown` bucket — fine locally.
 */
export function clientIp(c: Context<AppEnv>): string {
  const first = (name: string) => c.req.header(name)?.split(',')[0]?.trim();
  return first('x-vercel-forwarded-for') || first('x-real-ip') || first('x-forwarded-for') || 'unknown';
}

const CSRF = { 403: problemResponse('`client: "browser"` from outside the website.', 'auth.csrf') } as const;

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
        'Exchanges the e-mailed code for a session (use case SignIn; Better Auth). Creates the account on the first sign-in. **Phones** (default, `client: "phone"`): a bearer `token` in the body, about 60 days, sliding. **Browsers** (`client: "browser"`): no token in the body; the answer sets `__Secure-ct_session=…; Max-Age=2592000; Path=/api/v1; HttpOnly; Secure; SameSite=Strict` (host-only; without `Max-Age` when `sharedComputer`), 14 days sliding, at most 30 days (8 hours on a shared computer); the request must come from the website (`Origin`, `Sec-Fetch-Site`, `CityTurfer-Client: web/<version>`, else `403 auth.csrf`). A wrong or expired code is `401 auth.invalid-code`; three wrong tries burn the code (ask for a new one). Limits: 10 sign-ins per address and 20 failed sign-ins per IP (an IPv6 /64 counts as one IP) per 10 minutes, and 10 failed sign-ins per address per day (then even the right code answers `429` until the day is over).',
      request: { body: { required: true, content: json(SignInBody) } },
      responses: {
        200: {
          description: 'Signed in. Browsers: the session cookie is in `Set-Cookie`, the body has no token.',
          content: json(Session),
          headers: {
            'Set-Cookie': {
              description: 'Browsers only: the session cookie (`HttpOnly`, so page scripts never read it).',
              schema: {
                type: 'string',
                example: '__Secure-ct_session=…; Max-Age=2592000; Path=/api/v1; HttpOnly; Secure; SameSite=Strict',
              },
            },
          },
        },
        ...INVALID,
        401: problemResponse('Wrong, expired or used-up code.', 'auth.invalid-code'),
        ...CSRF,
        ...RATE_LIMITED,
        ...UNAVAILABLE,
      },
    },
    async (c) => {
      const { identity } = c.var.deps;
      const body = valid<z.infer<typeof SignInBody>>(c, 'json');
      const client = body.client ?? 'phone';
      // Login CSRF: a foreign page must not sign a browser into someone else's account.
      if (client === 'browser' && !isFromWebsite(c)) {
        return problem(c, 'auth.csrf', 'Browser sign-in works only from the website.');
      }
      if (!identity) {
        return problem(c, 'storage.unavailable', 'Sign-in is not configured on this server.');
      }
      const sharedComputer = client === 'browser' && body.sharedComputer === true;
      const session = await identity.signIn(body.email.toLowerCase(), body.code.trim(), clientIp(c), {
        client,
        sharedComputer,
      });
      c.header('Cache-Control', 'no-store');
      const answer = {
        client: session.client,
        expiresAt: iso(session.expiresAt),
        absoluteExpiresAt: session.absoluteExpiresAt === null ? null : iso(session.absoluteExpiresAt),
        user: session.user,
      };
      if (session.client === 'phone') {
        return c.json({ token: session.token, ...answer }, 200);
      }
      setCookie(c, SESSION_COOKIE, session.token, {
        ...SESSION_COOKIE_ATTRIBUTES,
        ...(sharedComputer ? {} : { maxAge: BROWSER_SESSION.absoluteS }),
      });
      return c.json(answer, 200);
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
        'Revokes the session of this bearer token or cookie (use case SignOut); it answers `401` afterwards. With the cookie the answer also clears it (`Max-Age=0`). Idempotent. A device token cannot be revoked here (remove it from `API_TOKENS`): `204` all the same. Signing out on the website never signs a phone out (that is `DELETE /v1/auth/sessions?scope=all`).',
      responses: { 204: { description: 'Signed out.' }, ...AUTH_ERRORS },
    },
    async (c) => {
      const { principal, deps } = c.var;
      if (principal.kind === 'session' && principal.sessionToken && deps.identity) {
        await deps.identity.signOut(principal.sessionToken);
      }
      if (principal.credential === 'cookie') {
        clearSessionCookie(c);
      }
      return c.body(null, 204);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/auth/sessions',
      tags: TAG,
      operationId: 'listSessions',
      summary: 'Signed-in devices',
      description:
        'The phones and browsers signed in to this account (use case ListSessions), most recently used first; `current` marks the one making this request. Ids are opaque and are not credentials. No IP address, user agent or location is stored, so none is shown. Device tokens (`API_TOKENS`) are not sessions and are not listed.',
      responses: {
        200: { description: 'The live sessions.', content: json(SessionList) },
        ...AUTH_ERRORS,
      },
    },
    async (c) => {
      const { identity } = c.var.deps;
      if (!identity) {
        return problem(c, 'storage.unavailable', 'Sign-in is not configured on this server.');
      }
      const sessions = await identity.listSessions(c.var.userId, c.var.principal.sessionId);
      return c.json(
        {
          sessions: sessions.map((s) => ({
            id: s.id,
            client: s.client,
            createdAt: iso(s.createdAt),
            lastActiveAt: iso(s.lastActiveAt),
            expiresAt: iso(s.expiresAt),
            current: s.current,
          })),
        },
        200
      );
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'delete',
      path: '/v1/auth/sessions/{sessionId}',
      tags: TAG,
      operationId: 'revokeSession',
      summary: 'Sign out one device',
      description:
        "Signs out one of this account's sessions (use case RevokeSession); that phone or browser answers `401` on its next request. Revoking the current browser session also clears its cookie. An id that is not one of your sessions — someone else's, or already signed out — is `404`.",
      request: { params: SessionIdParam },
      responses: {
        204: { description: 'Signed out.' },
        ...INVALID,
        ...AUTH_ERRORS,
        ...notFound('session'),
      },
    },
    async (c) => {
      const { identity } = c.var.deps;
      if (!identity) {
        return problem(c, 'storage.unavailable', 'Sign-in is not configured on this server.');
      }
      const { sessionId } = valid<z.infer<typeof SessionIdParam>>(c, 'param');
      const { principal, userId } = c.var;
      if (!(await identity.revokeSession(userId, sessionId))) {
        return problem(c, 'not-found');
      }
      if (principal.credential === 'cookie' && sessionId === principal.sessionId) {
        clearSessionCookie(c);
      }
      return c.body(null, 204);
    }
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'delete',
      path: '/v1/auth/sessions',
      tags: TAG,
      operationId: 'revokeSessions',
      summary: 'Sign out other devices, or everywhere',
      description:
        '`scope=others` signs out every session of this account but the current one; `scope=all` every session, this one and every phone included (use case RevokeSessions). Phones then answer `401` on their next request and must sign in again; their recorded data stays on them. With the cookie, `all` also clears it. Device tokens are not sessions and keep working. Idempotent.',
      request: { query: RevokeScopeQuery },
      responses: {
        204: { description: 'Signed out.' },
        ...INVALID,
        ...AUTH_ERRORS,
      },
    },
    async (c) => {
      const { identity } = c.var.deps;
      if (!identity) {
        return problem(c, 'storage.unavailable', 'Sign-in is not configured on this server.');
      }
      const { scope } = valid<z.infer<typeof RevokeScopeQuery>>(c, 'query');
      const { principal, userId } = c.var;
      await identity.revokeSessions(userId, scope, principal.sessionId);
      if (scope === 'all' && principal.credential === 'cookie') {
        clearSessionCookie(c);
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
