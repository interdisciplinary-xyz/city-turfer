import type { BackupStore, TurfUserEntry } from '../backup/ports';
import type { BackupService } from '../backup/use-cases';

/** Counts only: no user, activity or cell ids, no coordinates (they reach logs and terminals). */
export interface RebuildReport {
  /** Users with claims or Turf Cells when the run started. */
  users: number;
  /** Users whose cells or claims needed a repair (repaired, or would be on a dry run). */
  stale: number;
  /** Turf Cell rows that differed: stale, missing, or wrong counts / first claimer. */
  drift: number;
  /** Claims that no longer matched their activity's track, type or start: re-claimed. */
  staleClaims: number;
  /** Users erased since the run started: skipped, never re-created. */
  gone: number;
  /** Users whose rebuild failed (any error): run again. */
  failed: number;
  dryRun: boolean;
}

export interface RebuildOptions {
  /** Only this user. */
  userId?: string;
  /** Count, change nothing. */
  dryRun?: boolean;
  /** Users per query. */
  pageSize?: number;
}

export interface RebuildDeps {
  store: BackupStore;
  backup: BackupService;
  onProgress?: (p: { user: number; users: number; stale: number; drift: number; staleClaims: number }) => void;
  /** A user's rebuild failed: the error class only (never its message: it may hold data). */
  onFailure?: (errorName: string) => void;
}

async function usersOf(store: BackupStore, userId: string | undefined, pageSize: number) {
  const all: TurfUserEntry[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await store.turfUsers({ limit: pageSize, afterUserId: after, userId });
    all.push(...page);
    if (page.length < pageSize) {
      return all;
    }
    after = page.at(-1)!.userId;
  }
}

/**
 * RebuildTurf for every user with a projection (`turf:rebuild`): one locked transaction per user
 * (`BackupService.rebuildTurf`). The repair after a rollback to an API that did not maintain the
 * projection:
 * - its deletes and withdrawals cascaded claims away but left their cells (data derived from erased
 *   or withdrawn activities): the cells are recomputed from the claims that remain, where they
 *   differ; a user with cells and no claims loses them all;
 * - its replaces updated the activity and its track in place, so the claim kept the old cells, type
 *   and start: every claim whose track hash, type or start no longer matches is re-claimed.
 * Idempotent: a second run finds nothing to repair and changes nothing (no turf version bump).
 */
export async function rebuildTurf(deps: RebuildDeps, options: RebuildOptions = {}): Promise<RebuildReport> {
  const list = await usersOf(deps.store, options.userId, options.pageSize ?? 500);
  const report: RebuildReport = {
    users: list.length,
    stale: 0,
    drift: 0,
    staleClaims: 0,
    gone: 0,
    failed: 0,
    dryRun: !!options.dryRun,
  };
  for (const [i, { userId }] of list.entries()) {
    try {
      const r = await deps.backup.rebuildTurf(userId, { dryRun: options.dryRun });
      if (r.gone) {
        report.gone++;
      } else if (r.drift > 0 || r.staleClaims > 0) {
        report.stale++;
        report.drift += r.drift;
        report.staleClaims += r.staleClaims;
      }
    } catch (e) {
      report.failed++;
      deps.onFailure?.(e instanceof Error ? e.name : 'unknown');
    }
    deps.onProgress?.({
      user: i + 1,
      users: list.length,
      stale: report.stale,
      drift: report.drift,
      staleClaims: report.staleClaims,
    });
  }
  return report;
}
