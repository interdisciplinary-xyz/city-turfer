import { createHmac } from 'node:crypto';

import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { AuthVerifier, Principal } from '../deps';
import type { Auth } from './better-auth';
import { AUTH_LIMITS, type Limit, type RateLimiter } from './rate-limit';

/**
 * Identity use cases over Better Auth: RequestSignInCode, SignIn, SignOut, and the verifier for
 * session tokens. Rate limits (contract 0.4.0): codes 3 per e-mail and 10 per IP per 10 minutes,
 * sign-ins 10 per e-mail and 10 per IP per 10 minutes. Keys are HMACs, never the address or IP.
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
    await this.limit('codes:ip', ip, AUTH_LIMITS.codesPerIp);
    await this.limit('codes:email', email, AUTH_LIMITS.codesPerEmail);
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
    await this.limit('sign-in:ip', ip, AUTH_LIMITS.signInsPerIp);
    await this.limit('sign-in:email', email, AUTH_LIMITS.signInsPerEmail);
    let signedIn: { token: string; user: { id: string; email: string } };
    try {
      signedIn = await this.auth.api.signInEmailOTP({ body: { email, otp: code } });
    } catch (error) {
      if (isClientError(error)) {
        throw new AppError('auth.invalid-code');
      }
      throw error;
    }
    const session = await this.session(signedIn.token);
    if (!session) {
      throw new Error('session missing after sign-in');
    }
    return {
      token: signedIn.token,
      expiresAt: session.expiresAt,
      user: { id: signedIn.user.id, email: signedIn.user.email },
    };
  }

  /** SignOut: revokes the session of this token (idempotent). */
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
            sessionToken: token,
            profile: { email: s.email, displayName: null },
          }
        : null;
    },
  };

  private async session(token: string): Promise<{ userId: string; email: string; expiresAt: number } | null> {
    const found = await this.auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
    if (!found) {
      return null;
    }
    return {
      userId: found.user.id,
      email: found.user.email,
      expiresAt: new Date(found.session.expiresAt).getTime(),
    };
  }

  private async limit(scope: string, subject: string, limit: Limit): Promise<void> {
    const key = `${scope}:${createHmac('sha256', this.secret).update(subject).digest('base64url')}`;
    const { ok, retryAfterS } = await this.limiter.hit(key, limit.max, limit.windowMs, this.clock.now());
    if (!ok) {
      throw new AppError('auth.rate-limited', { 'Retry-After': String(retryAfterS) });
    }
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
