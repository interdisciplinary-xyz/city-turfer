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

const TEN_MINUTES = 10 * 60_000;
const ONE_DAY = 24 * 60 * 60_000;

/**
 * The contract's auth limits (backend contract 0.4.0). Per-IP buckets are the IPv4 address or the
 * IPv6 /64 (ipBucket). The per-address limits are the real protection; the per-IP ones are loose
 * because mobile carriers put many phones behind one IPv4 address (CGNAT), and for sign-ins they
 * count only failed attempts.
 *
 * The daily caps per address stop a slow brute force: each code allows 3 wrong tries, so the
 * 10-minute windows alone would allow about 1,300 guesses a day. With 10 failed sign-ins a day an
 * address takes at most 10 guesses a day against the 10^6 codes (about 0.4 % a year). The price: a
 * stranger who knows the address can block its sign-in for up to a day.
 */
export const AUTH_LIMITS = {
  codesPerEmail: { max: 3, windowMs: TEN_MINUTES },
  codesPerEmailPerDay: { max: 10, windowMs: ONE_DAY },
  codesPerIp: { max: 30, windowMs: TEN_MINUTES },
  signInsPerEmail: { max: 10, windowMs: TEN_MINUTES },
  failedSignInsPerEmailPerDay: { max: 10, windowMs: ONE_DAY },
  failedSignInsPerIp: { max: 20, windowMs: TEN_MINUTES },
} satisfies Record<string, Limit>;
