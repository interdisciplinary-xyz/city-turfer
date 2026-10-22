import { createHmac } from 'node:crypto';

import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { AuthVerifier, Credential, Principal, SessionClient } from '../deps';
import { type Auth, BROWSER_SESSION, SESSION_TTL_S, SESSION_UPDATE_AGE_S } from './better-auth';
import { ipBucket } from './ip-bucket';
import { AUTH_LIMITS, type Limit, type RateLimiter } from './rate-limit';

/** How a new session should live: a phone, a browser, or a browser on a shared computer. */
export interface SignInOptions {
  client: SessionClient;
  sharedComputer: boolean;
}

/** A new session. `token` is the signed credential: a bearer token, or the browser's cookie value. */
export interface SignedIn {
  token: string;
  client: SessionClient;
  expiresAt: number;
  /** Browsers only: the session never lives past this, however often it is used. */
  absoluteExpiresAt: number | null;
  user: { id: string; email: string };
}

/** One signed-in device as its owner sees it. No token, nothing that derives it, no IP or agent. */
export interface SessionView {
  id: string;
  client: SessionClient;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  current: boolean;
}

export type RevokeScope = 'others' | 'all';

const S = 1000;

/** Sliding rules per client: how long a session lives after use, and how often it is moved on. */
const SLIDING: Record<SessionClient, { ttlMs: number; updateAgeMs: number }> = {
  phone: { ttlMs: SESSION_TTL_S * S, updateAgeMs: SESSION_UPDATE_AGE_S * S },
  browser: { ttlMs: BROWSER_SESSION.ttlS * S, updateAgeMs: BROWSER_SESSION.updateAgeS * S },
};

const time = (value: Date | string | number | null | undefined): number | null =>
  value === null || value === undefined ? null : new Date(value).getTime();

/**
 * Identity use cases over Better Auth: RequestSignInCode, SignIn, SignOut, ListSessions,
 * RevokeSession(s), and the verifier for session tokens. Sessions slide here, not in Better Auth
 * (`disableSessionRefresh`): phones 60 days, browsers 14 days under an absolute cap. The clock must
 * agree with `Date` (Better Auth reads it for expiry); in production both are the system time. Rate limits: AUTH_LIMITS (per address, and per IP bucket: the IPv4 address or the
 * IPv6 /64). Keys are HMACs, never the address or IP.
 */
export class IdentityService {
  constructor(
    private readonly auth: Auth,
    private readonly limiter: RateLimiter,
    private readonly secret: string,
    private readonly clock: Clock
  ) {}

  /** RequestSignInCode: always "accepted" (unknown e-mails too: the account is made on sign-in). */
  async requestCode(email: string, ip: string): Promise<void> {
    await this.limit('codes:ip', ipBucket(ip), AUTH_LIMITS.codesPerIp);
    await this.limit('codes-minute:email', email, AUTH_LIMITS.codesPerEmailPerMinute);
    await this.limit('codes:email', email, AUTH_LIMITS.codesPerEmail);
    await this.limit('codes-day:email', email, AUTH_LIMITS.codesPerEmailPerDay);
    // A mail failure is logged (without the address) by createAuth's onMailError and answers 202
    // all the same: the phone shows "check your inbox" and the user can ask again.
    await this.auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
  }

  /** SignIn: exchanges a code for a bearer session; creates the account on the first sign-in. */
  async signIn(
    email: string,
    code: string,
    ip: string,
    options: SignInOptions = { client: 'phone', sharedComputer: false }
  ): Promise<SignedIn> {
    // Failures are checked first and counted only when they happen: per IP because many honest
    // phones share one IPv4 address (CGNAT), per address and day against a slow brute force.
    const failures = [
      { scope: 'sign-in-failed:ip', subject: ipBucket(ip), limit: AUTH_LIMITS.failedSignInsPerIp },
      { scope: 'sign-in-failed-day:email', subject: email, limit: AUTH_LIMITS.failedSignInsPerEmailPerDay },
    ];
    for (const f of failures) {
      await this.check(f.scope, f.subject, f.limit);
    }
    await this.limit('sign-in:email', email, AUTH_LIMITS.signInsPerEmail);
    let signedIn: { headers: Headers; response: { user: { id: string; email: string } } };
    try {
      signedIn = await this.auth.api.signInEmailOTP({ body: { email, otp: code }, returnHeaders: true });
    } catch (error) {
      if (isClientError(error)) {
        for (const f of failures) {
          await this.count(f.scope, f.subject, f.limit);
        }
        throw new AppError('auth.invalid-code');
      }
      throw error;
    }
    // The bearer plugin's signed form of the session token (`<token>.<HMAC>`): the only form it
    // accepts (requireSignature), so a copy of `auth_sessions` alone cannot sign anyone in.
    const token = signedIn.headers.get('set-auth-token');
    const session = token ? await this.session(token) : null;
    if (!token || !session) {
      throw new Error('session missing after sign-in');
    }
    const { user } = signedIn.response;
    const signed = { token, user: { id: user.id, email: user.email } };
    if (options.client === 'phone') {
      return { ...signed, client: 'phone', expiresAt: session.expiresAt, absoluteExpiresAt: null };
    }
    // Better Auth made a 60-day session: shorten it to a browser's before the token leaves here.
    const now = this.clock.now();
    const absoluteExpiresAt =
      now + (options.sharedComputer ? BROWSER_SESSION.sharedAbsoluteS : BROWSER_SESSION.absoluteS) * S;
    const expiresAt = Math.min(now + BROWSER_SESSION.ttlS * S, absoluteExpiresAt);
    const ctx = await this.auth.$context;
    try {
      const updated = await ctx.internalAdapter.updateSession(session.sessionToken, {
        client: 'browser',
        expiresAt: new Date(expiresAt),
        absoluteExpiresAt: new Date(absoluteExpiresAt),
      });
      if (!updated) {
        throw new Error('session vanished after sign-in');
      }
    } catch (error) {
      await ctx.internalAdapter.deleteSession(session.sessionToken).catch(() => undefined);
      throw error;
    }
    return { ...signed, client: 'browser', expiresAt, absoluteExpiresAt };
  }

  /** SignOut: revokes the session with this (raw, stored) session token (idempotent). */
  async signOut(token: string): Promise<void> {
    const ctx = await this.auth.$context;
    await ctx.internalAdapter.deleteSession(token);
  }

  /** ListSessions: the user's live sessions (phones and browsers), most recently used first. */
  async listSessions(userId: string, currentSessionId: string | undefined): Promise<SessionView[]> {
    const now = this.clock.now();
    const ctx = await this.auth.$context;
    const rows = (await ctx.internalAdapter.listSessions(userId)) as StoredSession[];
    return rows
      .map((r) => ({
        id: r.id,
        client: clientOf(r.client),
        createdAt: time(r.createdAt) ?? 0,
        lastActiveAt: time(r.updatedAt) ?? 0,
        expiresAt: time(r.expiresAt) ?? 0,
        absoluteExpiresAt: time(r.absoluteExpiresAt),
        current: r.id === currentSessionId,
      }))
      .filter((r) => r.expiresAt > now && (r.absoluteExpiresAt === null || r.absoluteExpiresAt > now))
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt || a.id.localeCompare(b.id))
      .map((r) => ({
        id: r.id,
        client: r.client,
        createdAt: r.createdAt,
        lastActiveAt: r.lastActiveAt,
        expiresAt: r.expiresAt,
        current: r.current,
      }));
  }

  /** RevokeSession: signs out one of the user's own sessions; false when it is not theirs or gone. */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const ctx = await this.auth.$context;
    const rows = (await ctx.internalAdapter.listSessions(userId)) as StoredSession[];
    const found = rows.find((r) => r.id === sessionId && r.userId === userId);
    if (!found) {
      return false;
    }
    await ctx.internalAdapter.deleteSession(found.token);
    return true;
  }

  /** RevokeSessions: every session of the user (`all`, phones included) or all but the current one. */
  async revokeSessions(userId: string, scope: RevokeScope, currentSessionId: string | undefined): Promise<void> {
    const ctx = await this.auth.$context;
    if (scope === 'all' || !currentSessionId) {
      await ctx.internalAdapter.deleteUserSessions(userId);
      return;
    }
    const rows = (await ctx.internalAdapter.listSessions(userId)) as StoredSession[];
    const others = rows.filter((r) => r.id !== currentSessionId && r.userId === userId).map((r) => r.token);
    if (others.length > 0) {
      await ctx.internalAdapter.deleteSessions(others);
    }
  }

  /**
   * The verifier half: a live session token → its user, else null. A phone session works only as a
   * bearer token and a browser session only from the cookie, so a token copied from one to the
   * other is refused. Slides the expiry here (at most once per `updateAgeMs`), never past the cap.
   */
  readonly verifier: AuthVerifier = {
    verify: async (token, credential: Credential = 'bearer'): Promise<Principal | null> => {
      const s = await this.session(token);
      if (!s || (credential === 'cookie') !== (s.client === 'browser')) {
        return null;
      }
      const now = this.clock.now();
      const ctx = await this.auth.$context;
      if (s.expiresAt <= now || (s.absoluteExpiresAt !== null && s.absoluteExpiresAt <= now)) {
        await ctx.internalAdapter.deleteSession(s.sessionToken);
        return null;
      }
      const { ttlMs, updateAgeMs } = SLIDING[s.client];
      if (s.expiresAt - ttlMs + updateAgeMs <= now) {
        const next = Math.min(now + ttlMs, s.absoluteExpiresAt ?? Number.POSITIVE_INFINITY);
        if (next > s.expiresAt) {
          await ctx.internalAdapter.updateSession(s.sessionToken, {
            expiresAt: new Date(next),
            updatedAt: new Date(now),
          });
        }
      }
      return {
        realm: 'user',
        userId: s.userId,
        verified: true,
        kind: 'session',
        credential,
        sessionToken: s.sessionToken,
        sessionId: s.sessionId,
        client: s.client,
        profile: { email: s.email, displayName: null },
      };
    },
  };

  private async session(token: string): Promise<{
    userId: string;
    email: string;
    expiresAt: number;
    absoluteExpiresAt: number | null;
    sessionToken: string;
    sessionId: string;
    client: SessionClient;
  } | null> {
    const found = await this.auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
    if (!found) {
      return null;
    }
    return {
      userId: found.user.id,
      email: found.user.email,
      expiresAt: new Date(found.session.expiresAt).getTime(),
      absoluteExpiresAt: time(found.session.absoluteExpiresAt),
      sessionToken: found.session.token,
      sessionId: found.session.id,
      client: clientOf(found.session.client),
    };
  }

  /** Counts one hit and refuses (429) once the limit is passed. */
  private async limit(scope: string, subject: string, limit: Limit): Promise<void> {
    rateLimited(await this.limiter.hit(this.key(scope, subject), limit.max, limit.windowMs, this.clock.now()));
  }

  /** Refuses (429) once the limit is reached, without counting (see `count`). */
  private async check(scope: string, subject: string, limit: Limit): Promise<void> {
    rateLimited(await this.limiter.peek(this.key(scope, subject), limit.max, limit.windowMs, this.clock.now()));
  }

  /** Counts one hit for a later `check` (a failure), without refusing this request. */
  private async count(scope: string, subject: string, limit: Limit): Promise<void> {
    await this.limiter.hit(this.key(scope, subject), limit.max, limit.windowMs, this.clock.now());
  }

  private key(scope: string, subject: string): string {
    return `${scope}:${createHmac('sha256', this.secret).update(subject).digest('base64url')}`;
  }
}

/** A row of `auth_sessions` as Better Auth's adapter reads it (our two columns included). */
interface StoredSession {
  id: string;
  token: string;
  userId: string;
  client?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
  absoluteExpiresAt?: Date | string | null;
}

/** Rows from before migration 0004 have the column default, `phone`; anything else is a browser. */
function clientOf(value: unknown): SessionClient {
  return value === 'browser' ? 'browser' : 'phone';
}

function rateLimited({ ok, retryAfterS }: { ok: boolean; retryAfterS: number }): void {
  if (!ok) {
    throw new AppError('auth.rate-limited', { 'Retry-After': String(retryAfterS) });
  }
}

/** Better Auth's APIError for a wrong, expired or burnt code (400/401/403), not a server fault. */
function isClientError(error: unknown): boolean {
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
}

/**
 * Device tokens first (no database round trip), then Better Auth sessions. Device tokens keep
 * working for one release (contract 0.4.0).
 */
export function compositeVerifier(...verifiers: AuthVerifier[]): AuthVerifier {
  return {
    async verify(token, credential) {
      for (const v of verifiers) {
        const principal = await v.verify(token, credential);
        if (principal) {
          return principal;
        }
      }
      return null;
    },
  };
}
