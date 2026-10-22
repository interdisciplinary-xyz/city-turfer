/** Port: fixed-window counters (Postgres in production and tests: src/db/rate-limits.ts). */
export interface RateLimiter {
  /** Counts one hit on `key`; `ok: false` once more than `max` hits fell in the current window. */
  hit(key: string, max: number, windowMs: number, now: number): Promise<{ ok: boolean; retryAfterS: number }>;
}

export interface Limit {
  max: number;
  windowMs: number;
}

const TEN_MINUTES = 10 * 60_000;

/** The contract's auth limits (backend contract 0.4.0). */
export const AUTH_LIMITS = {
  codesPerEmail: { max: 3, windowMs: TEN_MINUTES },
  codesPerIp: { max: 10, windowMs: TEN_MINUTES },
  signInsPerEmail: { max: 10, windowMs: TEN_MINUTES },
  signInsPerIp: { max: 10, windowMs: TEN_MINUTES },
} satisfies Record<string, Limit>;
