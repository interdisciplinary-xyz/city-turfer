import { retryDelayMs } from './backup-policy';

/**
 * The server copy of one Activity, as far as this phone knows:
 * `none` not there yet · `backed-up` stored (at `serverVersion`) · `deleted` we deleted it ·
 * `gone` deleted on the server (a tombstone: never uploaded again, delete wins) ·
 * `too-large` / `rejected` the server will not take this content (a corrected track may be retried).
 */
export type ServerCopy = 'none' | 'backed-up' | 'deleted' | 'gone' | 'too-large' | 'rejected';

/** What still has to be sent: create, replace (a corrected track, with If-Match) or delete. */
export type BackupOp = 'upload' | 'replace' | 'delete';
export type BackupStep = BackupOp | 'gap-routes';

export interface ActivityBackupState {
  readonly activityId: string;
  readonly startedAt: number;
  readonly status: ServerCopy;
  readonly op: BackupOp | null;
  /** The gap routes still have to be sent (after the Activity itself). */
  readonly gapsPending: boolean;
  /** +1 for every queued change; a finished send only clears the work it started with. */
  readonly rev: number;
  readonly serverVersion: number | null;
  readonly uploadedAt: number | null;
  readonly attempts: number;
  readonly nextAttemptAt: number | null;
  /** Last failure, as a code (never a message: it could carry user data). */
  readonly errorCode: string | null;
}

/**
 * Backup bookkeeping of one Activity. Invariants: a server tombstone (`gone`) or our own delete is
 * final, nothing is uploaded after it; a delete overrides any pending upload; a send that finishes
 * after newer changes were queued leaves those changes queued.
 */
export class ActivityBackup {
  private constructor(private state: ActivityBackupState) {}

  static track(activityId: string, startedAt: number): ActivityBackup {
    return new ActivityBackup({
      activityId,
      startedAt,
      status: 'none',
      op: null,
      gapsPending: false,
      rev: 0,
      serverVersion: null,
      uploadedAt: null,
      attempts: 0,
      nextAttemptAt: null,
      errorCode: null,
    });
  }

  static rehydrate(state: ActivityBackupState): ActivityBackup {
    return new ActivityBackup(state);
  }

  toState(): ActivityBackupState {
    return this.state;
  }

  get activityId(): string {
    return this.state.activityId;
  }

  get rev(): number {
    return this.state.rev;
  }

  /** Deleted here or on the server: nothing will ever be uploaded for it again. */
  get isClosed(): boolean {
    return this.state.status === 'gone' || this.state.status === 'deleted';
  }

  /** The work due now, or null (nothing queued, or waiting for a retry). */
  nextStep(now: number): BackupStep | null {
    const s = this.state;
    if (s.nextAttemptAt != null && s.nextAttemptAt > now) {
      return null;
    }
    if (s.op) {
      return s.op;
    }
    return s.gapsPending && s.status === 'backed-up' ? 'gap-routes' : null;
  }

  // --- queued changes (outbox handlers, planning) ----------------------------------------------

  /** A new Activity (or one the server does not have): upload it. */
  queueUpload(): void {
    const s = this.state;
    if (this.isClosed || s.op === 'delete' || s.status === 'too-large' || s.status === 'rejected') {
      return;
    }
    if (s.status === 'backed-up') {
      return; // already there; a changed track arrives as queueCorrection()
    }
    if (s.op === 'upload') {
      return;
    }
    this.change({ op: 'upload' });
  }

  /** The track was corrected: replace the server copy (or upload it, if it isn't there yet). */
  queueCorrection(): void {
    const s = this.state;
    if (this.isClosed || s.op === 'delete') {
      return;
    }
    if (s.status === 'backed-up') {
      this.change({ op: 'replace', attempts: 0, nextAttemptAt: null });
    } else {
      // New content: worth trying again even if the old one was refused.
      this.change({ status: 'none', op: 'upload', attempts: 0, nextAttemptAt: null, errorCode: null });
    }
  }

  /** Gap routes were (re-)estimated: send them once the Activity is on the server. */
  queueGapRoutes(): void {
    if (this.isClosed || this.state.op === 'delete') {
      return;
    }
    this.change({ gapsPending: true });
  }

  /** Deleted on the phone: delete the server copy too (a no-op on the server if it never got there). */
  queueDelete(): void {
    if (this.isClosed) {
      return;
    }
    this.change({ op: 'delete', gapsPending: false, attempts: 0, nextAttemptAt: null, errorCode: null });
  }

  // --- what the server's manifest says (first upload) ----------------------------------------

  /** The server already has this id (at `version`): nothing to upload unless a newer change is queued. */
  knownOnServer(version: number): void {
    const s = this.state;
    if (this.isClosed || s.op === 'delete') {
      return;
    }
    this.state = {
      ...s,
      status: 'backed-up',
      serverVersion: version,
      op: s.op === 'upload' ? null : s.op,
      errorCode: null,
    };
  }

  /** The server neither has it nor a tombstone for it: (re-)upload it. */
  missingOnServer(): void {
    const s = this.state;
    if (this.isClosed || s.op === 'delete' || s.status === 'too-large' || s.status === 'rejected') {
      return;
    }
    if (s.status === 'backed-up' || s.op !== 'upload') {
      this.change({ status: 'none', serverVersion: null, op: 'upload' });
    }
  }

  /** The server has a tombstone (410 / 409, or in the manifest): delete wins, never resurrect. */
  goneOnServer(): void {
    this.state = { ...this.state, status: 'gone', op: null, gapsPending: false, attempts: 0, nextAttemptAt: null };
  }

  // --- results of a send that started at `sentRev` ---------------------------------------------

  uploaded(sentRev: number, version: number, now: number, hasGapRoutes: boolean): void {
    const s = this.state;
    const newer = s.rev !== sentRev;
    this.state = {
      ...s,
      status: 'backed-up',
      serverVersion: version,
      uploadedAt: now,
      // A correction queued while uploading must still replace what was just sent.
      op: newer ? (s.op === 'upload' ? 'replace' : s.op) : null,
      gapsPending: s.gapsPending || hasGapRoutes,
      attempts: 0,
      nextAttemptAt: null,
      errorCode: null,
    };
  }

  gapRoutesSent(sentRev: number, version: number | null): void {
    const s = this.state;
    this.state = {
      ...s,
      serverVersion: version ?? s.serverVersion,
      gapsPending: s.rev !== sentRev ? s.gapsPending : false,
      attempts: 0,
      nextAttemptAt: null,
      errorCode: null,
    };
  }

  deleted(): void {
    this.state = { ...this.state, status: 'deleted', op: null, gapsPending: false, attempts: 0, nextAttemptAt: null };
  }

  /** The server refuses this content for good (too big, or invalid with `code`). */
  refused(sentRev: number, step: BackupStep, reason: 'too-large' | 'rejected', code: string): void {
    const s = this.state;
    if (s.rev !== sentRev) {
      this.state = { ...s, errorCode: code }; // newer changes queued: they get their own try
      return;
    }
    if (step === 'gap-routes') {
      this.state = { ...s, gapsPending: false, errorCode: code };
      return;
    }
    this.state = {
      ...s,
      // A refused replacement leaves the older copy on the server.
      status: s.status === 'backed-up' ? 'backed-up' : reason,
      op: null,
      gapsPending: false,
      attempts: 0,
      nextAttemptAt: null,
      errorCode: code,
    };
  }

  /** Nothing to send any more (e.g. the Activity is no longer on the phone; its delete follows). */
  dropUpload(): void {
    const s = this.state;
    if (s.op === 'upload' || s.op === 'replace') {
      this.state = { ...s, op: null, gapsPending: false };
    }
  }

  /** A failure worth retrying later (offline, server busy, stale version twice). */
  failed(code: string, now: number): void {
    const attempts = this.state.attempts + 1;
    this.state = { ...this.state, attempts, nextAttemptAt: now + retryDelayMs(attempts), errorCode: code };
  }

  private change(patch: Partial<ActivityBackupState>): void {
    this.state = { ...this.state, ...patch, rev: this.state.rev + 1 };
  }
}
