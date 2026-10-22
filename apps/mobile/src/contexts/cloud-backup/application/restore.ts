import { mayUpload } from '../domain/backup-policy';
import type { RestoreItem, RestoreState } from '../domain/restore';
import { connect, errorOf } from './backup-access';
import type { ApiClient, ChangesPage, CloudBackupDeps } from './ports';

/** Safety stop for a changes feed that never says `hasMore: false`. */
const MAX_MANIFEST_PAGES = 1_000;

export type RestoreOffer =
  | { kind: 'none' }
  /** The server holds `count` Activities and this profile has none of its own yet. */
  | { kind: 'available'; count: number }
  /** A restore was started and interrupted (app killed, recording, background): continue it. */
  | { kind: 'resume'; done: number; total: number };

export type RestoreResult =
  | { kind: 'done'; restored: number; skipped: number }
  /** Stopped for now (a recording started, the app went to the background, the network failed). */
  | { kind: 'paused'; reason: 'recording' | 'background' | 'offline' | 'server' | 'auth'; done: number; total: number }
  | { kind: 'unavailable'; reason: 'not-available' | 'no-token' | 'busy' };

export interface RestoreProgress {
  done: number;
  total: number;
}

/** Reads the whole manifest: the Activities the server holds (no tombstones) and the Home City. */
async function manifest(api: ApiClient) {
  const items = new Map<string, RestoreItem>();
  let homeCity: ChangesPage['homeCity'] = null;
  let cursor: string | null = null;
  for (let i = 0; i < MAX_MANIFEST_PAGES; i++) {
    const r = await api.changes(cursor);
    if (!r.ok) {
      return r;
    }
    for (const u of r.value.upserted) {
      items.set(u.id, { activityId: u.id, startedAt: u.startedAt, version: u.version });
    }
    for (const id of r.value.deleted) {
      items.delete(id);
    }
    homeCity = r.value.homeCity ?? homeCity;
    if (!r.value.hasMore) {
      break;
    }
    cursor = r.value.nextCursor;
  }
  return { ok: true as const, value: { items: [...items.values()], homeCity } };
}

/** Does this profile hold Activities of its own (anything but generated demo history)? */
async function hasOwnActivities(d: CloudBackupDeps): Promise<boolean> {
  return (await d.activities.timeline()).some((a) => mayUpload(a.id, true));
}

/**
 * Whether to offer "Restore from your backup": for a signed-in account whose profile has no
 * Activities of its own (a new phone, or a reinstall where the keychain survived) and a server that
 * holds some; or to continue one that was interrupted. Foreground only; one manifest read.
 */
export class GetRestoreOffer {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(): Promise<RestoreOffer> {
    if (!this.d.available || !this.d.isForeground()) {
      return { kind: 'none' };
    }
    const r = (await this.d.repo.restore()).toState();
    if (r.status === 'running') {
      return { kind: 'resume', done: r.done, total: r.total };
    }
    if (r.status === 'done' || (await hasOwnActivities(this.d))) {
      return { kind: 'none' };
    }
    const c = await connect(this.d, await this.d.repo.settings());
    if (c.kind !== 'connected') {
      return { kind: 'none' };
    }
    const m = await manifest(c.api);
    return m.ok && m.value.items.length > 0 ? { kind: 'available', count: m.value.items.length } : { kind: 'none' };
  }
}

/**
 * Brings the backup back onto this phone: the manifest first, then each Activity's detail and track,
 * oldest first, then the Home City with when it was chosen. Each Activity's backup row is written
 * (from the server copy) before it is imported, so nothing goes back up; imports are idempotent by
 * id, so a restore killed half-way resumes without duplicates. Never during a recording, foreground
 * only; Apple Health import and backup runs wait while it runs.
 */
export class RestoreFromBackup {
  private running: Promise<RestoreResult> | null = null;

  constructor(private readonly d: CloudBackupDeps) {}

  get isRunning(): boolean {
    return this.running != null;
  }

  execute(onProgress?: (p: RestoreProgress) => void): Promise<RestoreResult> {
    this.running ??= this.run(onProgress).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(onProgress?: (p: RestoreProgress) => void): Promise<RestoreResult> {
    const d = this.d;
    if (!d.available) {
      return { kind: 'unavailable', reason: 'not-available' };
    }
    const paused = (reason: Extract<RestoreResult, { kind: 'paused' }>['reason'], s: RestoreState): RestoreResult => ({
      kind: 'paused',
      reason,
      done: s.done,
      total: s.total,
    });
    let restore = await d.repo.restore();
    if (!d.isForeground()) {
      return paused('background', restore.toState());
    }
    if (await d.isRecording()) {
      return paused('recording', restore.toState());
    }
    const c = await connect(d, await d.repo.settings());
    if (c.kind !== 'connected') {
      return c.kind === 'failed' && c.error === 'no-token'
        ? { kind: 'unavailable', reason: 'no-token' }
        : c.kind === 'failed' && c.error === 'not-available'
          ? { kind: 'unavailable', reason: 'not-available' }
          : paused(c.kind === 'refused' ? 'auth' : stopOf(c.error), restore.toState());
    }

    if (!restore.isRunning) {
      const m = await manifest(c.api);
      if (!m.ok) {
        return paused(stopOf(errorOf(m.failure)), restore.toState());
      }
      const items = restore.start(m.value.items, m.value.homeCity, d.clock.now());
      await d.repo.startRestore(restore, items);
    }

    let restored = 0;
    let skipped = 0;
    for (const item of await d.repo.restoreItems()) {
      onProgress?.({ done: restore.toState().done, total: restore.toState().total });
      if (!d.isForeground()) {
        return paused('background', restore.toState());
      }
      if (await d.isRecording()) {
        return paused('recording', restore.toState());
      }
      const copy = await c.api.activityCopy(item.activityId);
      if (
        !copy.ok &&
        copy.failure.kind !== 'gone' &&
        copy.failure.kind !== 'not-found' &&
        copy.failure.kind !== 'rejected'
      ) {
        return paused(stopOf(errorOf(copy.failure)), restore.toState());
      }
      if (copy.ok) {
        // First the backup row (so the Activity never goes back up), then the Activity itself.
        await d.repo.updateBackupForRestore({ ...item, version: copy.value.version }, (b) =>
          b.restoredFromServer(copy.value.version, copy.value.gapsCheckedAt, d.clock.now())
        );
        const outcome = await d.restoredActivities.restore(copy.value);
        if (outcome === 'restored') {
          restored++;
        } else if (outcome === 'invalid') {
          skipped++;
        }
      } else {
        skipped++; // deleted on the server meanwhile, or content this phone can't read
      }
      restore = await d.repo.restoreItemDone(item.activityId, (r) => r.itemDone());
    }

    const homeCity = restore.toState().homeCity;
    if (homeCity) {
      // The server has this choice: record that first, so it is not sent back.
      await d.repo.saveRestore((_r, s) => s.homeCityRestored(homeCity.chosenAt));
      await d.homeCity.restore(homeCity);
    }
    const left = (await d.repo.restoreItems()).length;
    restore = await d.repo.saveRestore((r) => r.finish(left));
    onProgress?.({ done: restore.toState().done, total: restore.toState().total });
    return { kind: 'done', restored, skipped };
  }
}

function stopOf(code: string): 'offline' | 'server' | 'auth' {
  return code === 'offline' ? 'offline' : code === 'auth' ? 'auth' : 'server';
}
