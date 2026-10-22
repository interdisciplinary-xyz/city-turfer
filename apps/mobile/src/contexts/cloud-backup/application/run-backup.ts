import type { ActivityArchive } from '@/contexts/activity-log';

import type { ActivityBackup, BackupStep } from '../domain/activity-backup';
import { MAX_TRACK_POINTS, mayUpload, nameToUpload, sourceOf, trackHashInput } from '../domain/backup-policy';
import type { BackupErrorCode } from '../domain/backup-settings';
import { connect, deliverWithdrawals, errorOf } from './backup-access';
import type {
  ApiClient,
  ApiFailure,
  ApiResult,
  BackupRunReport,
  CloudBackupDeps,
  ServerActivity,
  ServerActivityHead,
} from './ports';

/** Safety stop for a changes feed that never says `hasMore: false`. */
const MAX_MANIFEST_PAGES = 1_000;

/** The archive to PUT, with the name that wins against the server's copy (if known). */
function withNewerName(archive: ActivityArchive, server: ServerActivityHead | null): ActivityArchive {
  if (server?.name == null) {
    return archive;
  }
  const name = nameToUpload(archive, { name: server.name, renamedAt: server.renamedAt });
  return name === archive.name ? archive : { ...archive, name };
}

export type BackupRunResult =
  | { kind: 'skipped'; reason: 'background' | 'off' | 'no-token' | 'waiting-for-token' | 'not-available' | 'busy' }
  | { kind: 'done'; report: BackupRunReport };

/**
 * Sends what is queued, foreground only: first (after turning backup on, or on another account)
 * compares the phone's history with the server's manifest — queues what the server lacks, replaces
 * a different track, renames a different name, deletes what was deleted here meanwhile — oldest
 * first; then uploads, replaces, renames and deletes Activities (two at a time), their gap routes
 * (an empty list too: "checked, no gaps"), and the Home City. Resumable:
 * every finished step is saved, an interrupted run continues where it stopped. One run at a time;
 * a call during a run joins it and triggers one more pass.
 */
export class RunBackup {
  private running: Promise<BackupRunResult> | null = null;
  private again = false;
  /** The token the server refused (401): not tried again until another one is in use. */
  private refusedToken: string | null = null;

  constructor(
    private readonly d: CloudBackupDeps,
    /** True while something else must have the backup tables to itself (Restore). */
    private readonly paused: () => boolean = () => false
  ) {}

  get isRunning(): boolean {
    return this.running != null;
  }

  /** Resolves once no run is in flight (a consent change must not race a run's withdrawals). */
  async whenIdle(): Promise<void> {
    while (this.running) {
      await this.running.catch(() => undefined);
    }
  }

  /** `now: true` ("Back up now"): also retry Activities that are waiting for their next attempt. */
  execute(options: { now?: boolean } = {}): Promise<BackupRunResult> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      let result: BackupRunResult;
      let force = options.now ?? false;
      do {
        this.again = false;
        result = await this.runOnce(force);
        force = false;
      } while (this.again && result.kind === 'done' && result.report.error == null);
      return result;
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce(force: boolean): Promise<BackupRunResult> {
    if (!this.d.available) {
      return { kind: 'skipped', reason: 'not-available' };
    }
    if (!this.d.isForeground()) {
      return { kind: 'skipped', reason: 'background' };
    }
    // A restore running now, or interrupted (it resumes first): its rows are not complete yet.
    if (this.paused() || (await this.d.repo.restore()).isRunning) {
      return { kind: 'skipped', reason: 'busy' };
    }
    const before = await this.d.repo.settings();
    if (!before.enabled && before.withdrawalsPending.length === 0) {
      return { kind: 'skipped', reason: 'off' };
    }
    const c = await connect(this.d, before, this.refusedToken);
    if (c.kind === 'refused') {
      return { kind: 'skipped', reason: 'waiting-for-token' };
    }
    if (c.kind === 'failed') {
      if (c.error === 'auth' && c.token) {
        this.refusedToken = c.token;
      }
      if (before.enabled) {
        await this.d.repo.updateSettings((x) => x.runFinished(this.d.clock.now(), c.error));
      }
      return c.error === 'no-token'
        ? { kind: 'skipped', reason: 'no-token' }
        : { kind: 'done', report: { uploaded: 0, deleted: 0, failed: 0, refused: 0, error: c.error } };
    }
    const { api } = c;
    const s = c.settings;
    const withdrawalError = await deliverWithdrawals(this.d, api, s);
    if (!s.enabled) {
      if (withdrawalError === 'auth') {
        this.refusedToken = c.token;
      }
      return { kind: 'skipped', reason: 'off' };
    }

    const report: BackupRunReport = { uploaded: 0, deleted: 0, failed: 0, refused: 0, error: null };
    let stop: BackupErrorCode | null = withdrawalError === 'auth' ? 'auth' : null;
    if (!stop && s.needsPlanning) {
      stop = await this.plan(api, s.healthIncluded);
    }
    if (!stop) {
      stop = await this.drain(api, report, force);
    }
    if (!stop) {
      stop = await this.sendHomeCity(api);
    }
    if (stop === 'auth') {
      this.refusedToken = c.token;
    }
    report.error = stop;
    await this.d.repo.updateSettings((x) => x.runFinished(this.d.clock.now(), stop));
    try {
      this.d.onRunFinished?.(report);
    } catch {
      // diagnostics never fail a run
    }
    return { kind: 'done', report };
  }

  /**
   * Compare with the server's manifest: queue what it lacks, replace or rename what differs, delete
   * what is gone from the phone, skip what it has, respect tombstones. Only Activities this phone
   * backed up are ever deleted (the server may hold others' uploads, e.g. before a restore).
   */
  private async plan(api: ApiClient, healthIncluded: boolean): Promise<BackupErrorCode | null> {
    const onServer = new Map<string, ServerActivity>();
    const tombstones = new Set<string>();
    let cursor: string | null = null;
    let page: string | null = null;
    for (let i = 0; i < MAX_MANIFEST_PAGES; i++) {
      const r = await api.changes(page);
      if (!r.ok) {
        return errorOf(r.failure);
      }
      for (const u of r.value.upserted) {
        onServer.set(u.id, u);
        tombstones.delete(u.id);
      }
      for (const id of r.value.deleted) {
        tombstones.add(id);
        onServer.delete(id);
      }
      cursor = r.value.nextCursor;
      if (!r.value.hasMore) {
        break;
      }
      page = cursor;
    }

    const local = (await this.d.activities.timeline()).filter((a) => mayUpload(a.id, healthIncluded));
    // What the phone has now of the Activities the server also has (one track at a time).
    const compared = new Map<
      string,
      { trackHash: string; name: string; renamedAt: number | null; gapsCheckedAt: number | null }
    >();
    for (const a of local) {
      if (!onServer.has(a.id) || tombstones.has(a.id)) {
        continue;
      }
      const archive = await this.d.activities.archiveOf(a.id);
      if (archive) {
        compared.set(a.id, {
          trackHash: await this.d.sha256(trackHashInput(archive.track)),
          name: archive.name,
          renamedAt: archive.renamedAt,
          gapsCheckedAt: archive.gapsCheckedAt,
        });
      }
    }
    await this.d.repo.updateBackups(local, (b) => {
      const server = onServer.get(b.activityId);
      const mine = compared.get(b.activityId);
      if (tombstones.has(b.activityId)) {
        b.goneOnServer();
      } else if (server && mine) {
        b.knownOnServer(server.version);
        b.reconcile(server, mine);
      } else if (!server) {
        b.missingOnServer();
      }
    });
    const onPhone = new Set((await this.d.activities.timeline()).map((a) => a.id));
    // Still to be restored: not on the phone yet, but not deleted either.
    const restoring = new Set((await this.d.repo.restoreItems()).map((i) => i.activityId));
    const gone = (await this.d.repo.backups())
      .filter((b) => !onPhone.has(b.activityId) && !restoring.has(b.activityId))
      .map((b) => ({ id: b.activityId, startedAt: b.toState().startedAt }));
    await this.d.repo.updateBackups(gone, (b) => b.deletedOnPhone());

    const homeCity = await this.d.homeCity.choice();
    await this.d.repo.updateSettings((x) => {
      x.planned(this.d.clock.now(), cursor);
      if (homeCity) {
        x.queueHomeCity(homeCity.chosenAt);
      }
    });
    return null;
  }

  private async drain(api: ApiClient, report: BackupRunReport, force: boolean): Promise<BackupErrorCode | null> {
    const dueBy = force ? Number.POSITIVE_INFINITY : this.d.clock.now();
    const queue = (await this.d.repo.withWork()).filter((b) => b.nextStep(dueBy) != null);
    let stop: BackupErrorCode | null = null;
    const worker = async () => {
      while (stop == null && queue.length > 0) {
        const b = queue.shift()!;
        const s = await this.d.repo.settings();
        if (!s.enabled) {
          return; // turned off mid-run: stop quietly
        }
        stop = (await this.process(api, b, b.nextStep(dueBy)!, s.healthIncluded, report)) ?? stop;
      }
    };
    const workers = Math.max(1, Math.min(2, this.d.concurrency ?? 2));
    await Promise.all(Array.from({ length: workers }, worker));
    return stop;
  }

  private async process(
    api: ApiClient,
    b: ActivityBackup,
    step: BackupStep,
    healthIncluded: boolean,
    report: BackupRunReport
  ): Promise<BackupErrorCode | null> {
    const id = b.activityId;
    const rev = b.rev;
    if (step === 'delete') {
      const r = await api.deleteActivity(id);
      if (r.ok || r.failure.kind === 'gone' || r.failure.kind === 'not-found') {
        await this.update(b, (x) => x.deleted());
        report.deleted++;
        return null;
      }
      return this.failure(b, step, rev, r.failure, report);
    }
    if (!mayUpload(id, healthIncluded)) {
      return null; // an Apple Health import without that consent: stays queued, not sent
    }
    const archive = await this.d.activities.archiveOf(id);
    if (!archive) {
      await this.update(b, (x) => x.dropUpload()); // deleted on the phone: its ActivityDeleted follows
      return null;
    }
    if (step === 'gap-routes') {
      return this.sendGapRoutes(api, b, archive, rev, report);
    }
    if (step === 'rename') {
      return this.sendRename(api, b, archive, rev, report);
    }
    if (archive.track.length > MAX_TRACK_POINTS) {
      await this.update(b, (x) => x.refused(rev, step, 'too-large', 'payload-too-large'));
      report.refused++;
      return null;
    }

    const meta = {
      source: sourceOf(id) === 'apple-health' ? ('apple-health' as const) : ('recording' as const),
      // Kept with the Activity when it was saved: a retry after travelling sends the same content.
      timeZone: archive.timeZone,
    };
    // A PUT carries a name and the server takes it (keeping its renamedAt): read the server's name
    // first when it has a copy, so a newer rename from another phone is kept (nameToUpload).
    const put = (ifMatchVersion: number | null, server: ServerActivityHead | null) =>
      api.putActivity(withNewerName(archive, server), meta, ifMatchVersion);
    let head: ServerActivityHead | null = null;
    if (step === 'replace') {
      const h = await api.activityVersion(id);
      if (!h.ok && h.failure.kind !== 'not-found') {
        return this.failure(b, step, rev, h.failure, report);
      }
      head = h.ok ? h.value : null;
    }
    let r: ApiResult<{ version: number }> = await put(step === 'replace' ? b.toState().serverVersion : null, head);
    if (!r.ok && r.failure.kind === 'precondition') {
      // 412 (stale version) or 428 (the server has other content): read its version and name, retry once.
      const current = await api.activityVersion(id);
      r = current.ok ? await put(current.value.version, current.value) : current;
    }
    if (!r.ok) {
      return this.failure(b, step, rev, r.failure, report);
    }
    const version = r.value.version;
    const gapsChecked = archive.gapsCheckedAt != null;
    const after = await this.update(b, (x) => x.uploaded(rev, version, this.d.clock.now(), gapsChecked));
    report.uploaded++;
    if (after.nextStep(this.d.clock.now()) === 'gap-routes') {
      return this.sendGapRoutes(api, after, archive, after.rev, report);
    }
    return null;
  }

  private async sendRename(
    api: ApiClient,
    b: ActivityBackup,
    archive: ActivityArchive,
    rev: number,
    report: BackupRunReport
  ): Promise<BackupErrorCode | null> {
    if (archive.renamedAt == null) {
      // Never renamed on this phone: its name is no newer than the server's. Stamping it "now" would
      // beat a real rename from another phone (last write wins on renamedAt), so nothing is sent.
      await this.update(b, (x) => x.renamed(rev, null));
      return null;
    }
    const r = await api.renameActivity(archive.id, archive.name, archive.renamedAt);
    if (r.ok) {
      await this.update(b, (x) => x.renamed(rev, r.value.version));
      return null;
    }
    if (r.failure.kind === 'not-found') {
      await this.update(b, (x) => x.missingOnServer()); // the server lost it: the upload carries the name
      return null;
    }
    return this.failure(b, 'rename', rev, r.failure, report);
  }

  private async sendGapRoutes(
    api: ApiClient,
    b: ActivityBackup,
    archive: ActivityArchive,
    rev: number,
    report: BackupRunReport
  ): Promise<BackupErrorCode | null> {
    const checkedAt = archive.gapsCheckedAt;
    if (checkedAt == null) {
      await this.update(b, (x) => x.gapRoutesSent(rev, null, null)); // reset by a correction: re-estimated later
      return null;
    }
    // An empty list too: it tells the server (and a restore) "checked, no gaps".
    const r = await api.putGapRoutes(archive.id, checkedAt, archive.gapRoutes);
    if (r.ok) {
      await this.update(b, (x) => x.gapRoutesSent(rev, r.value.version, checkedAt));
      return null;
    }
    if (r.failure.kind === 'not-found') {
      await this.update(b, (x) => x.missingOnServer()); // the server lost it: upload it again
      return null;
    }
    return this.failure(b, 'gap-routes', rev, r.failure, report);
  }

  /** Records a failed step; returns an error code when the whole run has to stop. */
  private async failure(
    b: ActivityBackup,
    step: BackupStep,
    rev: number,
    f: ApiFailure,
    report: BackupRunReport
  ): Promise<BackupErrorCode | null> {
    const now = this.d.clock.now();
    switch (f.kind) {
      case 'gone':
        await this.update(b, (x) => x.goneOnServer());
        return null;
      case 'too-large':
        await this.update(b, (x) => x.refused(rev, step, 'too-large', 'payload-too-large'));
        report.refused++;
        return null;
      case 'rejected':
        await this.update(b, (x) => x.refused(rev, step, 'rejected', f.code));
        report.refused++;
        return null;
      case 'precondition':
      case 'not-found':
        await this.update(b, (x) => x.failed(f.kind, now));
        report.failed++;
        return null;
      case 'unavailable':
        if (f.reason === 'server') {
          await this.update(b, (x) => x.failed('server', now)); // this Activity might be the cause: back off
          report.failed++;
        }
        return f.reason;
      default:
        return errorOf(f); // auth, consent, offline, outdated: nothing wrong with this Activity
    }
  }

  private async sendHomeCity(api: ApiClient): Promise<BackupErrorCode | null> {
    if (!(await this.d.repo.settings()).homeCityPending) {
      return null;
    }
    const choice = await this.d.homeCity.choice();
    if (choice) {
      const r = await api.putHomeCity(choice);
      // A city the server doesn't know (422) is dropped: retrying would not change the answer.
      if (!r.ok && r.failure.kind !== 'rejected') {
        return errorOf(r.failure);
      }
    }
    await this.d.repo.updateSettings((x) => x.homeCityDelivered(choice?.chosenAt ?? null));
    return null;
  }

  private update(b: ActivityBackup, change: (x: ActivityBackup) => void): Promise<ActivityBackup> {
    return this.d.repo.updateBackup(b.activityId, b.toState().startedAt, change);
  }
}
