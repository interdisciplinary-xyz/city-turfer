import type { Clock } from '../backup/use-cases';
import type { ApiLog } from '../deps';
import type { RetentionReport, RetentionStore } from './ports';

/**
 * PurgeExpiredData: deletes what outlived its retention — export zips (GPS tracks) 24 h after they
 * were made, expired sign-in codes and sessions, stale rate-limit counters. Run daily by Vercel Cron
 * (`GET /internal/cron/retention`, apps/api/vercel.json) and, for export files, on every new export
 * request too. Logs the counts only.
 */
export class RetentionService {
  constructor(
    private readonly store: RetentionStore,
    private readonly clock: Clock,
    private readonly log: ApiLog
  ) {}

  async purge(): Promise<RetentionReport> {
    const report = await this.store.purgeExpired(this.clock.now());
    this.log.event?.({ msg: 'retention.purged', ...report });
    return report;
  }
}
