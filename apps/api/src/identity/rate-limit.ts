import { createHmac } from 'node:crypto';

import { AppError } from '../backup/app-error';

/** Port: fixed-window counters (Postgres in production and tests: src/db/rate-limits.ts). */
export interface RateLimiter {
  /** Counts one hit on `key`; `ok: false` once more than `max` hits fell in the current window. */
  hit(key: string, max: number, windowMs: number, now: number): Promise<{ ok: boolean; retryAfterS: number }>;
  /** Like `hit` without counting: `ok: false` once `max` hits already fell in the current window. */
  peek(key: string, max: number, windowMs: number, now: number): Promise<{ ok: boolean; retryAfterS: number }>;
}

export interface Limit {
  max: number;
  windowMs: number;
}

const ONE_MINUTE = 60_000;
const TEN_MINUTES = 10 * ONE_MINUTE;
const ONE_DAY = 24 * 60 * 60_000;

/**
 * The contract's auth limits (backend contract 0.4.0; 0.5.0 adds the account-settings codes).
 * Per-IP buckets are the IPv4 address or the IPv6 /64 (ipBucket). The per-address limits are the
 * real protection for sign-in; the per-IP ones are loose because mobile carriers put many phones
 * behind one IPv4 address (CGNAT), and for sign-ins they count only failed attempts.
 *
 * The daily caps per address stop a slow brute force: each code allows 3 wrong tries, so the
 * 10-minute windows alone would allow about 1,300 guesses a day. With 10 failed sign-ins a day an
 * address takes at most 10 guesses a day against the 10^6 codes (about 0.4 % a year). The price: a
 * stranger who knows the address can block its sign-in for up to a day.
 *
 * Mails per address: at most one sign-in (or new-address) code a minute, 3 per 10 minutes and 10 a
 * day (inbox spam, Brevo cost). A request while a code is still valid mails that same code
 * (`resendStrategy: 'reuse'`), so asking for codes never voids the one the user already has.
 *
 * Step-up codes (account settings) are counted per **account** (user id), not per address: only a
 * signed-in session can fill those buckets, so a stranger who fills an address's sign-in buckets
 * cannot also stop its owner from changing the password or e-mail, the only actions that evict a
 * stolen session. 1 a minute, 5 per 10 minutes, 20 a day, plus the shared per-IP mail bucket. Wrong
 * step-up and new-address codes count per account too (10 a day, plus the per-IP failure bucket):
 * at most 10 guesses a day against the 10^6 codes, the same bound as sign-in.
 */
export const AUTH_LIMITS = {
  codesPerEmailPerMinute: { max: 1, windowMs: ONE_MINUTE },
  codesPerEmail: { max: 3, windowMs: TEN_MINUTES },
  codesPerEmailPerDay: { max: 10, windowMs: ONE_DAY },
  codesPerIp: { max: 30, windowMs: TEN_MINUTES },
  signInsPerEmail: { max: 10, windowMs: TEN_MINUTES },
  failedSignInsPerEmailPerDay: { max: 10, windowMs: ONE_DAY },
  failedSignInsPerIp: { max: 20, windowMs: TEN_MINUTES },
  stepUpCodesPerUserPerMinute: { max: 1, windowMs: ONE_MINUTE },
  stepUpCodesPerUser: { max: 5, windowMs: TEN_MINUTES },
  stepUpCodesPerUserPerDay: { max: 20, windowMs: ONE_DAY },
  /** Wrong step-up and new-address codes of one account (not its address's sign-in buckets). */
  failedAccountCodesPerUserPerDay: { max: 10, windowMs: ONE_DAY },
  /** Outbound breach checks (HIBP) per account, so `PUT /v1/me/password` cannot be used to pump them. */
  breachChecksPerUser: { max: 10, windowMs: TEN_MINUTES },
} satisfies Record<string, Limit>;

/**
 * The A5 buckets as operations, shared by the sign-in and account use cases: every code mailed to
 * an address counts in that address's counters; step-up codes and wrong account codes in the
 * account's. Keys are HMACs of the subject (address, user id or IP bucket) under
 * BETTER_AUTH_SECRET, never the subject itself.
 */
export class AuthRateLimits {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly secret: string,
    private readonly clock: { now(): number }
  ) {}

  /**
   * Before mailing a sign-in or new-address code to `email`: per IP, and per address a minute, 10
   * minutes and a day (both kinds in the same buckets).
   */
  async codeMail(email: string, ipBucket: string): Promise<void> {
    for (const [scope, subject, limit] of this.codeMailBuckets(email, ipBucket)) {
      await this.limit(scope, subject, limit);
    }
  }

  /** Like `codeMail` without counting: refuses (429) when a code mail would be refused now. */
  async checkCodeMail(email: string, ipBucket: string): Promise<void> {
    for (const [scope, subject, limit] of this.codeMailBuckets(email, ipBucket)) {
      await this.check(scope, subject, limit);
    }
  }

  /**
   * Before mailing a step-up code to the account `userId`: per IP, and per account a minute, 10
   * minutes and a day. Not the address's sign-in buckets, so a stranger cannot fill them.
   */
  async stepUpMail(userId: string, ipBucket: string): Promise<void> {
    const buckets: [string, string, Limit][] = [
      ['codes:ip', ipBucket, AUTH_LIMITS.codesPerIp],
      ['step-up-codes-minute:user', userId, AUTH_LIMITS.stepUpCodesPerUserPerMinute],
      ['step-up-codes:user', userId, AUTH_LIMITS.stepUpCodesPerUser],
      ['step-up-codes-day:user', userId, AUTH_LIMITS.stepUpCodesPerUserPerDay],
    ];
    for (const [scope, subject, limit] of buckets) {
      await this.limit(scope, subject, limit);
    }
  }

  /** Before an outbound breach check for `userId`: counts it, 429 past the per-account cap. */
  async breachCheck(userId: string): Promise<void> {
    await this.limit('breach-checks:user', userId, AUTH_LIMITS.breachChecksPerUser);
  }

  private codeMailBuckets(email: string, ipBucket: string): [string, string, Limit][] {
    return [
      ['codes:ip', ipBucket, AUTH_LIMITS.codesPerIp],
      ['codes-minute:email', email, AUTH_LIMITS.codesPerEmailPerMinute],
      ['codes:email', email, AUTH_LIMITS.codesPerEmail],
      ['codes-day:email', email, AUTH_LIMITS.codesPerEmailPerDay],
    ];
  }

  /**
   * Before checking a sign-in code or password for `email`: refuses (429) once the failed-attempt
   * caps are reached, without counting. Returns `failed()`, to call when the attempt fails.
   */
  beforeAttempt(email: string, ipBucket: string): Promise<{ failed: () => Promise<void> }> {
    return this.failureCaps([
      { scope: 'sign-in-failed:ip', subject: ipBucket, limit: AUTH_LIMITS.failedSignInsPerIp },
      { scope: 'sign-in-failed-day:email', subject: email, limit: AUTH_LIMITS.failedSignInsPerEmailPerDay },
    ]);
  }

  /**
   * Before checking a step-up or new-address code of the account `userId`: like `beforeAttempt`,
   * but per account (and per IP), never the address's sign-in buckets.
   */
  beforeAccountCode(userId: string, ipBucket: string): Promise<{ failed: () => Promise<void> }> {
    return this.failureCaps([
      { scope: 'sign-in-failed:ip', subject: ipBucket, limit: AUTH_LIMITS.failedSignInsPerIp },
      { scope: 'account-code-failed-day:user', subject: userId, limit: AUTH_LIMITS.failedAccountCodesPerUserPerDay },
    ]);
  }

  private async failureCaps(
    failures: { scope: string; subject: string; limit: Limit }[]
  ): Promise<{ failed: () => Promise<void> }> {
    for (const f of failures) {
      await this.check(f.scope, f.subject, f.limit);
    }
    return {
      failed: async () => {
        for (const f of failures) {
          await this.count(f.scope, f.subject, f.limit);
        }
      },
    };
  }

  /** Every sign-in attempt (code or password) for `email`, failed or not. */
  async signInAttempt(email: string): Promise<void> {
    await this.limit('sign-in:email', email, AUTH_LIMITS.signInsPerEmail);
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
