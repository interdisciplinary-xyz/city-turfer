import { createHmac } from 'node:crypto';

import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { AuthVerifier, Principal } from '../deps';
import type { Auth } from './better-auth';
import { ipBucket } from './ip-bucket';
import { AUTH_LIMITS, type Limit, type RateLimiter } from './rate-limit';

/**
 * Identity use cases over Better Auth: RequestSignInCode, SignIn, SignOut, and the verifier for
 * session tokens. Rate limits: AUTH_LIMITS (per address, and per IP bucket: the IPv4 address or the
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
    ip: string
  ): Promise<{ token: string; expiresAt: number; user: { id: string; email: string } }> {
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
    return {
      token,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email },
    };
  }

  /** SignOut: revokes the session with this (raw, stored) session token (idempotent). */
  async signOut(token: string): Promise<void> {
    const ctx = await this.auth.$context;
    await ctx.internalAdapter.deleteSession(token);
  }

  /** The verifier half: a live session token → its user, else null. */
  readonly verifier: AuthVerifier = {
    verify: async (token): Promise<Principal | null> => {
      const s = await this.session(token);
      return s
        ? {
            userId: s.userId,
            verified: true,
            kind: 'session',
            sessionToken: s.sessionToken,
            profile: { email: s.email, displayName: null },
          }
        : null;
    },
  };

  private async session(
    token: string
  ): Promise<{ userId: string; email: string; expiresAt: number; sessionToken: string } | null> {
    const found = await this.auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
    if (!found) {
      return null;
    }
    return {
      userId: found.user.id,
      email: found.user.email,
      expiresAt: new Date(found.session.expiresAt).getTime(),
      sessionToken: found.session.token,
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
    async verify(token) {
      for (const v of verifiers) {
        const principal = await v.verify(token);
        if (principal) {
          return principal;
        }
      }
      return null;
    },
  };
}
