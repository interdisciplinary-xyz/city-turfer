import type { OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';

import { clientIp as clientIpOf } from '../client-ip';
import type { AppEnv } from '../deps';
import { type AccountCaller, accountCaller, type AccountService } from '../identity/account';
import { BROWSER_SESSION } from '../identity/better-auth';
import { clearSessionCookie, isFromWebsite } from '../middleware';
import { problem } from '../problem';
import { AUTH_ERRORS, INVALID, notFound, problemResponse, UNAVAILABLE } from '../schemas/common';
import {
  ChangeEmailBody,
  CodeRequested,
  EmailChangeCodeBody,
  RemovePasswordBody,
  RequestCodeBody,
  RevokeScopeQuery,
  Session,
  SessionIdParam,
  SessionList,
  SetPasswordBody,
  SignInBody,
  UpdateMeBody,
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

/** The caller's IP for the per-IP limits (src/client-ip.ts: which forwarded header is trusted). */
export function clientIp(c: Context<AppEnv>): string {
  return clientIpOf((name) => c.req.header(name), c.var.deps.webEdgeSecret);
}

const CSRF = { 403: problemResponse('`client: "browser"` from outside the website.', 'auth.csrf') } as const;

/** Account-settings routes: a signed-in account (else 403) on a server with sign-in (else 503). */
async function withAccount(
  c: Context<AppEnv>,
  run: (accounts: AccountService, caller: AccountCaller) => Promise<Response>
): Promise<Response> {
  const caller = accountCaller(c.var.principal);
  const { accounts } = c.var.deps;
  if (!accounts) {
    return problem(c, 'storage.unavailable', 'Accounts are not configured on this server.');
  }
  return run(accounts, caller);
}

/** The current user with its password state (`GET`/`PATCH /v1/me`, `POST /v1/me/email`). */
async function me(c: Context<AppEnv>): Promise<Response> {
  const user = await c.var.backup.me(c.var.userId);
  const credential = await c.var.deps.accounts?.credential(c.var.userId);
  return c.json(userDto(user, credential), 200);
}

const ACCOUNT_REQUIRED = {
  403: problemResponse(
    'Signed in with a device token: account settings need an account session (sign in with a code).',
    'identity.account-required'
  ),
} as const;

/** 401 of the routes that spend a code: no or a bad token, or a wrong, expired or used-up code. */
const CODE_REFUSED = {
  401: problemResponse(
    'Missing or invalid bearer token (checked before the input), or a wrong, expired or used-up code.',
    'auth.missing',
    'auth.invalid',
    'auth.invalid-code'
  ),
} as const;

const STEP_UP =
  "Needs a fresh step-up code (`POST /v1/me/step-up/codes`): it is spent here, three wrong tries burn it, and wrong tries count against the account (10 a day per account, 20 per IP per 10 minutes), not the address's sign-in limits.";

/**
 * Identity: e-mail codes, sign-in (code or password), sign-out, the current user and the account
 * settings (use cases in src/identity/).
 */
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
      summary: 'Sign in with the code or the password',
      description:
        'Exchanges the e-mailed code, or the account password, for a session (use cases SignIn and SignInWithPassword; Better Auth). A code creates the account on the first sign-in; a password never does. **Phones** (default, `client: "phone"`): a bearer `token` in the body, about 60 days, sliding. **Browsers** (`client: "browser"`, with a code or a password): no token in the body; the answer sets `__Secure-ct_session=…; Max-Age=2592000; Path=/api/v1; HttpOnly; Secure; SameSite=Strict` (host-only; without `Max-Age` when `sharedComputer`), 14 days sliding, at most 30 days (8 hours on a shared computer); the request must come from the website (`Origin`, `Sec-Fetch-Site`, `CityTurfer-Client: web/<version>`, else `403 auth.csrf`). A wrong or expired code is `401 auth.invalid-code`; three wrong tries burn the code (ask for a new one). A wrong password, an account without a password and an unknown address are all `401 auth.invalid-credentials`. Limits (codes and passwords together): 10 sign-ins per address and 20 failed sign-ins per IP (an IPv6 /64 counts as one IP) per 10 minutes, and 10 failed sign-ins per address per day (then even the right code or password answers `429` until the day is over).',
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
        401: problemResponse(
          'Wrong, expired or used-up code; or wrong e-mail or password.',
          'auth.invalid-code',
          'auth.invalid-credentials'
        ),
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
      const options = { client, sharedComputer };
      const email = body.email.toLowerCase();
      const session =
        'code' in body
          ? await identity.signIn(email, body.code.trim(), clientIp(c), options)
          : await identity.signInWithPassword(email, body.password, clientIp(c), options);
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
        'The user the bearer token belongs to (use case GetCurrentUser): name, e-mail and whether a password is set; the server row is created on the first authenticated request. Consents, export and erasure live under Privacy.',
      responses: {
        200: { description: 'The signed-in user.', content: json(User) },
        ...AUTH_ERRORS,
      },
    },
    me
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'patch',
      path: '/v1/me',
      tags: TAG,
      operationId: 'updateMe',
      summary: 'Change my name',
      description:
        'Sets the name (use case RenameAccount; the core rule `displayName`: trimmed, NFC, at most 40 characters, no control characters). A blank name clears it (`name: null`; UIs show "You").',
      request: { body: { required: true, content: json(UpdateMeBody) } },
      responses: {
        200: { description: 'The user with the new name.', content: json(User) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...ACCOUNT_REQUIRED,
        422: problemResponse('The name breaks the rule.', 'display-name.too-long', 'display-name.invalid'),
      },
    },
    (c) =>
      withAccount(c, async (accounts, caller) => {
        const body = valid<z.infer<typeof UpdateMeBody>>(c, 'json');
        await accounts.rename(caller, body.name);
        return me(c);
      })
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'post',
      path: '/v1/me/step-up/codes',
      tags: TAG,
      operationId: 'requestStepUpCode',
      summary: 'E-mail me a step-up code',
      description:
        "Mails a 6-digit code (10 minutes, single use) to the account's **current** address (use case RequestStepUpCode), to confirm a sensitive change: a new e-mail, or setting, changing or removing the password. Limits per **account**, not per address: 1 code a minute, 5 per 10 minutes and 20 a day, plus the 30 codes per IP (an IPv6 /64 counts as one IP) per 10 minutes of sign-in codes; so a stranger who uses up the address's sign-in limits cannot block it. While a code is still valid and not burnt, a new request mails the same code again.",
      request: { body: { required: false, content: json(CodeRequested) } },
      responses: {
        202: { description: 'Code sent.', content: json(CodeRequested) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...ACCOUNT_REQUIRED,
        ...RATE_LIMITED,
      },
    },
    (c) =>
      withAccount(c, async (accounts, caller) => {
        await accounts.requestStepUpCode(caller, clientIp(c));
        return c.json({}, 202);
      })
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'post',
      path: '/v1/me/email/codes',
      tags: TAG,
      operationId: 'requestEmailChangeCode',
      summary: 'E-mail a code to my new address',
      description: `Starts an e-mail change (use case RequestEmailChange). ${STEP_UP} Then mails a 6-digit code (10 minutes) to the new address. When the new address already belongs to another account the answer is the same \`202\` (no enumeration) and that inbox gets an "address in use" mail instead of a code. The new address counts in the code limits of that address.`,
      request: { body: { required: true, content: json(EmailChangeCodeBody) } },
      responses: {
        202: { description: 'Code sent if the address can receive it.', content: json(CodeRequested) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CODE_REFUSED,
        ...ACCOUNT_REQUIRED,
        422: problemResponse('Not a valid new address.', 'email.invalid', 'email.unchanged'),
        ...RATE_LIMITED,
      },
    },
    (c) =>
      withAccount(c, async (accounts, caller) => {
        const body = valid<z.infer<typeof EmailChangeCodeBody>>(c, 'json');
        await accounts.requestEmailChange(caller, body.newEmail, body.stepUpCode.trim(), clientIp(c));
        return c.json({}, 202);
      })
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'post',
      path: '/v1/me/email',
      tags: TAG,
      operationId: 'changeEmail',
      summary: 'Change my e-mail with the code from the new inbox',
      description:
        "Moves the account to the new address (use case ChangeEmail): the sign-in address and the account e-mail change together, pending codes are cleared, **every other session is signed out** (this one stays) and the old address gets a notice. A wrong, expired or missing code is `401 auth.invalid-code` (also when the address was taken at the code step: no code was sent). `409 email.taken` only once the code proved the new inbox and another account took the address since. Wrong codes count against the account (10 a day), not the address's sign-in limits.",
      request: { body: { required: true, content: json(ChangeEmailBody) } },
      responses: {
        200: { description: 'The user with the new address.', content: json(User) },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CODE_REFUSED,
        ...ACCOUNT_REQUIRED,
        409: problemResponse('Another account has this address.', 'email.taken'),
        422: problemResponse('Not a valid new address.', 'email.invalid', 'email.unchanged'),
        ...RATE_LIMITED,
      },
    },
    (c) =>
      withAccount(c, async (accounts, caller) => {
        const body = valid<z.infer<typeof ChangeEmailBody>>(c, 'json');
        await accounts.changeEmail(caller, body.newEmail, body.code.trim(), clientIp(c));
        return me(c);
      })
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'put',
      path: '/v1/me/password',
      tags: TAG,
      operationId: 'setPassword',
      summary: 'Set or change my password',
      description: `Sets the account password, or replaces it (use case SetPassword). Optional: codes keep working, and a forgotten password is "sign in with a code, then set a new one". Rules: 12 to 128 characters, any characters, not trimmed, no composition rules; a password found in known data breaches (Have I Been Pwned, k-anonymity) is \`422 password.breached\`. The rules are checked before the step-up code, so a refused password does not spend it. ${STEP_UP} Afterwards **every other session is signed out** and the account gets a notice.`,
      request: { body: { required: true, content: json(SetPasswordBody) } },
      responses: {
        204: { description: 'Password set.' },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CODE_REFUSED,
        ...ACCOUNT_REQUIRED,
        422: problemResponse(
          'The password breaks a rule.',
          'password.too-short',
          'password.too-long',
          'password.breached'
        ),
        ...RATE_LIMITED,
      },
    },
    (c) =>
      withAccount(c, async (accounts, caller) => {
        const body = valid<z.infer<typeof SetPasswordBody>>(c, 'json');
        await accounts.setPassword(caller, body.newPassword, body.stepUpCode.trim(), clientIp(c));
        return c.body(null, 204);
      })
  );

  defineRoute(
    app,
    {
      status: 'live',
      method: 'delete',
      path: '/v1/me/password',
      tags: TAG,
      operationId: 'removePassword',
      summary: 'Remove my password',
      description: `Removes the account password (use case RemovePassword): sign-in is by e-mailed code only again. ${STEP_UP} Afterwards **every other session is signed out** (also without a password: \`204\`, idempotent); the account gets a notice when a password was removed.`,
      request: { body: { required: true, content: json(RemovePasswordBody) } },
      responses: {
        204: { description: 'No password any more.' },
        ...INVALID,
        ...AUTH_ERRORS,
        ...CODE_REFUSED,
        ...ACCOUNT_REQUIRED,
        ...RATE_LIMITED,
      },
    },
    (c) =>
      withAccount(c, async (accounts, caller) => {
        const body = valid<z.infer<typeof RemovePasswordBody>>(c, 'json');
        await accounts.removePassword(caller, body.stepUpCode.trim(), clientIp(c));
        return c.body(null, 204);
      })
  );
}
