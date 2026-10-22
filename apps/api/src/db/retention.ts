import { lt } from 'drizzle-orm';

import type { RetentionReport, RetentionStore } from '../privacy/ports';
import { PostgresFileStorage } from './exports';
import { STALE_RATE_LIMIT_MS } from './rate-limits';
import { authSessions, authVerifications, rateLimits } from './schema';
import type { Db } from './store';

/**
 * The scheduled purge (`GET /internal/cron/retention`, daily): export zips past their expiry, and
 * the auth rows nothing reads any more — expired codes and sessions (Better Auth ignores them) and
 * stale rate-limit counters (also trimmed on each hit, but only for keys still being hit).
 */
export class DrizzleRetentionStore implements RetentionStore {
  constructor(private readonly db: Db) {}

  async purgeExpired(now: number): Promise<RetentionReport> {
    const at = new Date(now);
    const exportFiles = await new PostgresFileStorage(this.db).purgeExpired(now);
    const codes = await this.db
      .delete(authVerifications)
      .where(lt(authVerifications.expiresAt, at))
      .returning({ id: authVerifications.id });
    const sessions = await this.db
      .delete(authSessions)
      .where(lt(authSessions.expiresAt, at))
      .returning({ id: authSessions.id });
    const limits = await this.db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStartedAt, new Date(now - STALE_RATE_LIMIT_MS)))
      .returning({ key: rateLimits.key });
    return { exportFiles, signInCodes: codes.length, sessions: sessions.length, rateLimits: limits.length };
  }
}
