import { lt, sql } from 'drizzle-orm';

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
    await this.db.delete(rateLimits).where(lt(rateLimits.windowStartedAt, new Date(now - windowMs - RETENTION_MS)));
    const endsAt = row.windowStartedAt.getTime() + windowMs;
    return { ok: row.hits <= max, retryAfterS: Math.max(1, Math.ceil((endsAt - now) / 1000)) };
  }
}
