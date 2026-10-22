import { AppError } from '../backup/app-error';
import type { Clock } from '../backup/use-cases';
import type { AuthVerifier, Principal } from '../deps';
import type { Auth } from './better-auth';
import { ipBucket } from './ip-bucket';
import { AuthRateLimits, type RateLimiter } from './rate-limit';

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

export interface SignedIn {
  token: string;
  expiresAt: number;
  user: { id: string; email: string };
}

/**
 * Identity use cases over Better Auth: RequestSignInCode, SignIn (code), SignInWithPassword,
 * SignOut, and the verifier for session tokens. Rate limits: AUTH_LIMITS (per address, and per IP
 * bucket: the IPv4 address or the IPv6 /64). Keys are HMACs, never the address or IP.
 */
export class IdentityService {
  readonly limits: AuthRateLimits;

  constructor(
    private readonly auth: Auth,
    limiter: RateLimiter,
    secret: string,
    clock: Clock,
    private readonly stamps: SignInStamps
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

  /** SignIn: exchanges a code for a bearer session; creates the account on the first sign-in. */
  signIn(email: string, code: string, ip: string): Promise<SignedIn> {
    return this.attempt(email, ip, 'auth.invalid-code', () =>
      this.auth.api.signInEmailOTP({ body: { email, otp: code }, returnHeaders: true })
    );
  }

  /**
   * SignInWithPassword: the same session as a code sign-in. A wrong password, an account without
   * one and an unknown address are the same 401 `auth.invalid-credentials`, in about the same time
   * (Better Auth hashes the given password when there is nothing to compare it with), and count in
   * the same failed-sign-in buckets as codes. Never creates an account.
   */
  signInWithPassword(email: string, password: string, ip: string): Promise<SignedIn> {
    return this.attempt(email, ip, 'auth.invalid-credentials', () =>
      this.auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
    );
  }

  private async attempt(
    email: string,
    ip: string,
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
    return {
      token,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email },
    };
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
