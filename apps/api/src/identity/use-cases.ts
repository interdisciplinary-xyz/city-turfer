import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { AuthVerifier, Credential, Principal, SessionClient } from '../deps';
import { type Auth, BROWSER_SESSION, SESSION_TTL_S, SESSION_UPDATE_AGE_S } from './better-auth';
import { ipBucket } from './ip-bucket';
import { AuthRateLimits, type RateLimiter } from './rate-limit';
import type { SessionStore } from './session-store';

/**
 * What a sign-in was checked against: the account an address signs in to, its address and its
 * password hash (null without a password). Compared in memory only, never logged.
 */
export interface SignInStamp {
  userId: string;
  email: string;
  password: string | null;
}

/** Port: the stamps of `IdentityService`'s revocation re-check (src/db/accounts.ts). */
export interface SignInStamps {
  /** The account `email` signs in to now, or null when none. */
  byEmail(email: string): Promise<SignInStamp | null>;
  /** The account `userId` as it is now, or null when it is gone. */
  byUser(userId: string): Promise<SignInStamp | null>;
}

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

const PHONE: SignInOptions = { client: 'phone', sharedComputer: false };

/** Sliding rules per client: how long a session lives after use, and how often it is moved on. */
const SLIDING: Record<SessionClient, { ttlMs: number; updateAgeMs: number }> = {
  phone: { ttlMs: SESSION_TTL_S * S, updateAgeMs: SESSION_UPDATE_AGE_S * S },
  browser: { ttlMs: BROWSER_SESSION.ttlS * S, updateAgeMs: BROWSER_SESSION.updateAgeS * S },
};

const time = (value: Date | string | number | null | undefined): number | null =>
  value === null || value === undefined ? null : new Date(value).getTime();

/**
 * Identity use cases over Better Auth: RequestSignInCode, SignIn (code), SignInWithPassword,
 * SignOut, ListSessions, RevokeSession(s), and the verifier for session tokens. Sessions slide
 * here, not in Better Auth (`disableSessionRefresh`): phones 60 days, browsers 14 days under an
 * absolute cap. The clock must agree with `Date` (Better Auth reads it for expiry); in production
 * both are the system time. Rate limits: AUTH_LIMITS (per address, and per IP bucket: the IPv4
 * address or the IPv6 /64). Keys are HMACs, never the address or IP.
 */
export class IdentityService {
  readonly limits: AuthRateLimits;

  constructor(
    private readonly auth: Auth,
    limiter: RateLimiter,
    secret: string,
    private readonly clock: Clock,
    private readonly stamps: SignInStamps,
    private readonly sessions: SessionStore
  ) {
    this.limits = new AuthRateLimits(limiter, secret, clock);
  }

  /** RequestSignInCode: always "accepted" (unknown e-mails too: the account is made on sign-in). */
  async requestCode(email: string, ip: string): Promise<void> {
    await this.limits.codeMail(email, ipBucket(ip));
    // A mail failure is logged (without the address) by createAuth's onMailError and answers 202
    // all the same: the phone shows "check your inbox" and the user can ask again.
    await this.auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
  }

  /**
   * SignIn: exchanges a code for a session (a phone's bearer token, or a browser's cookie value);
   * creates the account on the first sign-in.
   */
  signIn(email: string, code: string, ip: string, options: SignInOptions = PHONE): Promise<SignedIn> {
    return this.attempt(email, ip, options, 'auth.invalid-code', () =>
      this.auth.api.signInEmailOTP({ body: { email, otp: code }, returnHeaders: true })
    );
  }

  /**
   * SignInWithPassword: the same session as a code sign-in. A wrong password, an account without
   * one and an unknown address are the same 401 `auth.invalid-credentials`, in about the same time
   * (Better Auth hashes the given password when there is nothing to compare it with), and count in
   * the same failed-sign-in buckets as codes. Never creates an account.
   */
  signInWithPassword(email: string, password: string, ip: string, options: SignInOptions = PHONE): Promise<SignedIn> {
    return this.attempt(email, ip, options, 'auth.invalid-credentials', () =>
      this.auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
    );
  }

  private async attempt(
    email: string,
    ip: string,
    options: SignInOptions,
    refusal: 'auth.invalid-code' | 'auth.invalid-credentials',
    signIn: () => Promise<{ headers: Headers; response: { user: { id: string; email: string } } }>
  ): Promise<SignedIn> {
    // Failures are checked first and counted only when they happen: per IP because many honest
    // phones share one IPv4 address (CGNAT), per address and day against a slow brute force.
    const attempt = await this.limits.beforeAttempt(email, ipBucket(ip));
    await this.limits.signInAttempt(email);
    const before = await this.stamps.byEmail(email);
    let signedIn: { headers: Headers; response: { user: { id: string; email: string } } };
    try {
      signedIn = await signIn();
    } catch (error) {
      if (isClientError(error)) {
        await attempt.failed();
        throw new AppError(refusal);
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
    // A password or e-mail change that committed while this sign-in was being checked revoked the
    // sessions that existed then, not this one: re-read the account after the session exists (a
    // change committing later deletes it itself) and drop the session if anything moved.
    if (before && !(await this.unchanged(before, user.id))) {
      await this.signOut(session.sessionToken);
      throw new AppError(refusal);
    }
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

  /** Same account, same address, same password hash as when the sign-in started. */
  private async unchanged(before: SignInStamp, userId: string): Promise<boolean> {
    const now = await this.stamps.byUser(userId);
    return (
      now !== null && now.userId === before.userId && now.email === before.email && now.password === before.password
    );
  }

  /** SignOut: revokes the session with this (raw, stored) session token (idempotent). */
  async signOut(token: string): Promise<void> {
    const ctx = await this.auth.$context;
    await ctx.internalAdapter.deleteSession(token);
  }

  /** ListSessions: the user's live sessions (phones and browsers), most recently used first. */
  async listSessions(userId: string, currentSessionId: string | undefined): Promise<SessionView[]> {
    const rows = await this.sessions.listLive(userId, this.clock.now());
    return rows.map((r) => ({
      id: r.id,
      client: clientOf(r.client),
      createdAt: r.createdAt,
      lastActiveAt: r.updatedAt,
      expiresAt: r.expiresAt,
      current: r.id === currentSessionId,
    }));
  }

  /** RevokeSession: signs out one of the user's own live sessions; false when it is not theirs or gone. */
  revokeSession(userId: string, sessionId: string): Promise<boolean> {
    return this.sessions.revokeLive(userId, sessionId, this.clock.now());
  }

  /** RevokeSessions: every session of the user (`all`, phones included) or all but the current one. */
  async revokeSessions(userId: string, scope: RevokeScope, currentSessionId: string | undefined): Promise<void> {
    await this.sessions.revokeAll(userId, scope === 'all' ? undefined : currentSessionId);
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
      // At most once per `updateAgeMs`: record the use (`lastActiveAt`) and slide the expiry. Once the
      // expiry is at its cap the use is still recorded, so the list keeps a true "last used".
      const { ttlMs, updateAgeMs } = SLIDING[s.client];
      if (s.expiresAt - ttlMs + updateAgeMs <= now && now - s.updatedAt >= updateAgeMs) {
        const next = Math.min(now + ttlMs, s.absoluteExpiresAt ?? Number.POSITIVE_INFINITY);
        await ctx.internalAdapter.updateSession(s.sessionToken, {
          ...(next > s.expiresAt ? { expiresAt: new Date(next) } : {}),
          updatedAt: new Date(now),
        });
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
    updatedAt: number;
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
      updatedAt: new Date(found.session.updatedAt).getTime(),
      sessionToken: found.session.token,
      sessionId: found.session.id,
      client: clientOf(found.session.client),
    };
  }
}

/** Rows from before migration 0004 have the column default, `phone`; anything else is a browser. */
function clientOf(value: unknown): SessionClient {
  return value === 'browser' ? 'browser' : 'phone';
}

/** Better Auth's APIError for a wrong, expired or burnt code or a wrong password (4xx), not a server fault. */
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
