import { and, eq, gt, lt, sql } from 'drizzle-orm';

import { AUTH_LIMITS, type RateLimiter } from '../identity/rate-limit';
import { rateLimits } from './schema';
import type { Db } from './store';

/** Rows whose window ended this long ago are deleted (keys are pseudonymous, still personal data). */
const RETENTION_MS = 60 * 60_000;

/** Past this age a counter is stale under every limit (longest window + RETENTION_MS). */
export const STALE_RATE_LIMIT_MS = Math.max(...Object.values(AUTH_LIMITS).map((l) => l.windowMs)) + RETENTION_MS;

/**
 * Fixed-window rate limits in Postgres (`rate_limits`): one atomic upsert per hit, so concurrent
 * function instances share the count. Works the same on Neon and PGlite.
 */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly db: Db) {}

  async hit(key: string, max: number, windowMs: number, now: number) {
    const at = new Date(now);
    // Raw SQL gets ISO strings with a cast: drivers differ on Date parameters.
    const atSql = sql`${at.toISOString()}::timestamptz`;
    const expired = sql`${new Date(now - windowMs).toISOString()}::timestamptz`;
    const [row] = await this.db
      .insert(rateLimits)
      .values({ key, windowStartedAt: at, hits: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          hits: sql`CASE WHEN ${rateLimits.windowStartedAt} <= ${expired} THEN 1 ELSE ${rateLimits.hits} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${rateLimits.windowStartedAt} <= ${expired} THEN ${atSql} ELSE ${rateLimits.windowStartedAt} END`,
        },
      })
      .returning({ hits: rateLimits.hits, windowStartedAt: rateLimits.windowStartedAt });
    // By the longest window, not this one: a short limit's hit must not delete a daily counter.
    await this.db.delete(rateLimits).where(lt(rateLimits.windowStartedAt, new Date(now - STALE_RATE_LIMIT_MS)));
    return { ok: row.hits <= max, retryAfterS: retryAfter(row.windowStartedAt, windowMs, now) };
  }

  async peek(key: string, max: number, windowMs: number, now: number) {
    const [row] = await this.db
      .select({ hits: rateLimits.hits, windowStartedAt: rateLimits.windowStartedAt })
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), gt(rateLimits.windowStartedAt, new Date(now - windowMs))));
    return !row || row.hits < max
      ? { ok: true, retryAfterS: 0 }
      : { ok: false, retryAfterS: retryAfter(row.windowStartedAt, windowMs, now) };
  }
}

const retryAfter = (windowStartedAt: Date, windowMs: number, now: number) =>
  Math.max(1, Math.ceil((windowStartedAt.getTime() + windowMs - now) / 1000));
