import type { BackupStore, TurfBacklogEntry } from '../backup/ports';
import type { BackupService } from '../backup/use-cases';

/** Counts only: no user, activity or cell ids, no coordinates (they reach logs and terminals). */
export interface BackfillProgress {
  /** 1-based position of the user being worked on, of `users`. */
  user: number;
  users: number;
  claimed: number;
  deferred: number;
  skipped: number;
  failed: number;
}

export interface BackfillReport {
  /** Users with unclaimed activities that have a track when the run started. */
  users: number;
  /** Activities without a claim that have a track when the run started. */
  pending: number;
  claimed: number;
  /** Starts still in the future (`claim.in-future`): claimed by a later run once due. */
  deferred: number;
  /**
   * Activities without a claim that cannot be claimed (no track row, or no points): reported once
   * per run, never attempted, and never counted in `pending` or `remaining`, so they cannot keep a
   * run (or the cron) busy. They stay out of every later run too until a track arrives (an upload
   * that brings one claims at once). The runbook's diagnostic SQL lists them for support.
   */
  skipped: number;
  /** Activities whose claim failed (any other error): the user is skipped until the next run. */
  failed: number;
  /** Activities with a track still without a claim at the end. */
  remaining: number;
  /** `done`: no user left; `budget` or `deadline`: stopped early (run again to continue). */
  stopped: 'done' | 'budget' | 'deadline' | 'dry-run';
}

export interface BackfillOptions {
  /** Only this user. */
  userId?: string;
  /** Count, claim nothing. */
  dryRun?: boolean;
  /** Stop after this many claim attempts (the cron's ~25). */
  maxActivities?: number;
  /** Stop before an attempt that would start at or after this time (`now()` ms; the cron's ~60 s). */
  deadlineAt?: number;
  /** Users per backlog query. */
  pageSize?: number;
}

export interface BackfillDeps {
  store: BackupStore;
  backup: BackupService;
  /** Wall clock for `deadlineAt` (default Date.now). */
  now?: () => number;
  onProgress?: (p: BackfillProgress) => void;
  /** An activity's claim failed: the error class only (never its message: it may hold data). */
  onFailure?: (errorName: string) => void;
}

async function backlogOf(store: BackupStore, userId: string | undefined, pageSize: number) {
  const all: TurfBacklogEntry[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await store.turfBacklog({ limit: pageSize, afterUserId: after, userId });
    all.push(...page);
    if (page.length < pageSize) {
      return all;
    }
    after = page.at(-1)!.userId;
  }
}

/**
 * Claims the turf of activities that have none (TurfBackfill): those uploaded before the server
 * claimed turf, and deferred future starts once due. Per user, oldest first by `(startedAt, id)`,
 * **one activity per locked transaction** (`BackupService.catchUpTurf(userId, 1)`: one track in
 * memory, never a long lock), so it is idempotent, resumable after any stop, and safe next to
 * uploads — an activity claimed meanwhile is simply no longer unclaimed. A user stops at their
 * first deferred start (every later one is later still), skipped activity, or erasure, and after
 * as many attempts as they had pending (so a run always ends, whatever a claim returns). A failed
 * claim is counted and passed over for the rest of the run; the next run tries it again first.
 * Activities without a track are counted as `skipped` and never attempted.
 */
export async function backfillTurf(deps: BackfillDeps, options: BackfillOptions = {}): Promise<BackfillReport> {
  const now = deps.now ?? Date.now;
  const pageSize = options.pageSize ?? 500;
  const all = await backlogOf(deps.store, options.userId, pageSize);
  const backlog = all.filter((e) => e.unclaimed > 0);
  const pending = backlog.reduce((n, e) => n + e.unclaimed, 0);
  const report: BackfillReport = {
    users: backlog.length,
    pending,
    claimed: 0,
    deferred: 0,
    skipped: all.reduce((n, e) => n + e.untracked, 0),
    failed: 0,
    remaining: pending,
    stopped: 'done',
  };
  if (options.dryRun) {
    return { ...report, stopped: 'dry-run' };
  }
  let attempts = 0;
  const stopBefore = (): BackfillReport['stopped'] | null => {
    if (options.maxActivities !== undefined && attempts >= options.maxActivities) {
      return 'budget';
    }
    if (options.deadlineAt !== undefined && now() >= options.deadlineAt) {
      return 'deadline';
    }
    return null;
  };
  outer: for (const [i, entry] of backlog.entries()) {
    // Activities of this user whose claim failed in this run: still unclaimed and the oldest, so the
    // next attempt passes over them (by position: no activity id leaves the database).
    let failedHere = 0;
    for (let tries = 0; tries < entry.unclaimed; tries++) {
      const stop = stopBefore();
      if (stop) {
        report.stopped = stop;
        break outer;
      }
      attempts++;
      let result: Awaited<ReturnType<BackupService['catchUpTurf']>>;
      try {
        result = await deps.backup.catchUpTurf(entry.userId, 1, failedHere);
      } catch (e) {
        // One activity that keeps failing must not hold back the user's newer ones.
        report.failed++;
        failedHere++;
        deps.onFailure?.(e instanceof Error ? e.name : 'unknown');
        continue;
      }
      report.claimed += result.claimed;
      report.deferred += result.deferred;
      report.skipped += result.skipped;
      if (result.claimed === 0) {
        // Deferred (all later starts are later still), skipped, erased meanwhile, or nothing left.
        break;
      }
    }
    deps.onProgress?.({
      user: i + 1,
      users: backlog.length,
      claimed: report.claimed,
      deferred: report.deferred,
      skipped: report.skipped,
      failed: report.failed,
    });
  }
  report.remaining = (await backlogOf(deps.store, options.userId, pageSize)).reduce((n, e) => n + e.unclaimed, 0);
  return report;
}
