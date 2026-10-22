import { DomainError } from '@/shared-kernel';

import { missingOnPhone, type RestoreItem, type RestoreState, worthOffering } from '../domain/restore';
import { connect, errorOf } from './backup-access';
import type { ApiClient, ChangesPage, CloudBackupDeps, ConsentPurpose } from './ports';

/** Safety stop for a changes feed that never says `hasMore: false`. */
const MAX_MANIFEST_PAGES = 1_000;

export type RestoreOffer =
  | { kind: 'none' }
  /** The server holds `count` Activities this phone doesn't have (and didn't delete). */
  | { kind: 'available'; count: number }
  /** A restore was started and interrupted (app killed, recording, background): continue it. */
  | { kind: 'resume'; done: number; total: number };

export type RestoreResult =
  /** `backupOn`: backup is on afterwards (the server's consents turned it on, or it already was). */
  | { kind: 'done'; restored: number; skipped: number; backupOn: boolean }
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

/** The manifest's Activities this phone lacks: not on it, and not deleted on it (see missingOnPhone). */
async function missing(d: CloudBackupDeps, manifestItems: readonly RestoreItem[]): Promise<RestoreItem[]> {
  const onPhone = new Set((await d.activities.timeline()).map((a) => a.id));
  const known = new Set([...(await d.repo.backups()).map((b) => b.activityId), ...(await d.repo.deletedHereIds())]);
  return missingOnPhone(manifestItems, onPhone, known);
}

/**
 * Whether to offer "Restore from your backup": for a signed-in account whose server copy holds
 * Activities this phone doesn't have (a new phone, a reinstall, or a walk recorded before restoring)
 * and that the Turfer hasn't said "Not now" to; or to continue one that was interrupted. Foreground
 * only; one manifest read.
 */
export class GetRestoreOffer {
  /** The ids behind the last "available" offer, for "Not now". */
  private offered: string[] = [];

  constructor(private readonly d: CloudBackupDeps) {}

  get lastOffered(): readonly string[] {
    return this.offered;
  }

  async execute(): Promise<RestoreOffer> {
    this.offered = [];
    if (!this.d.available || !this.d.isForeground()) {
      return { kind: 'none' };
    }
    const r = (await this.d.repo.restore()).toState();
    if (r.status === 'running') {
      return { kind: 'resume', done: r.done, total: r.total };
    }
    const c = await connect(this.d, await this.d.repo.settings());
    if (c.kind !== 'connected') {
      return { kind: 'none' };
    }
    const m = await manifest(c.api);
    if (!m.ok) {
      return { kind: 'none' };
    }
    const lacking = await missing(this.d, m.value.items);
    if (!worthOffering(lacking, new Set(await this.d.repo.declinedRestoreIds()))) {
      return { kind: 'none' };
    }
    this.offered = lacking.map((i) => i.activityId);
    return { kind: 'available', count: lacking.length };
  }
}

/** "Not now": the Activities just offered are not offered again (new ones on the server are). */
export class DismissRestoreOffer {
  constructor(
    private readonly d: CloudBackupDeps,
    private readonly offer: GetRestoreOffer
  ) {}
  async execute(): Promise<void> {
    await this.d.repo.declineRestore(this.offer.lastOffered);
  }
}

/**
 * Brings the backup back onto this phone, merging: the manifest first (only what the phone lacks and
 * didn't delete), then each Activity's detail and track, oldest first, then the Home City with when
 * it was chosen. Nothing on the phone is overwritten or duplicated: imports are idempotent by id, so
 * a restore killed half-way resumes without duplicates. Each restored Activity gets its backup row
 * (from the server copy), so nothing goes back up. Afterwards the server's consents turn backup on
 * here too. Never during a recording, foreground only; Apple Health import and backup runs wait.
 */
export class RestoreFromBackup {
  private running: Promise<RestoreResult> | null = null;

  constructor(
    private readonly d: CloudBackupDeps,
    /** Waits for a backup run in flight (its comparison must not race the restore's rows). */
    private readonly backupIdle: () => Promise<void> = async () => undefined
  ) {}

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
    await this.backupIdle();
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
      const items = restore.start(await missing(d, m.value.items), m.value.homeCity, d.clock.now());
      await d.repo.startRestore(restore, items);
    }

    let restored = 0;
    let skipped = 0;
    const unreadable: string[] = [];
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
        // First the Activity (origin 'restore': Cloud Backup never queues it), then its backup row.
        // Never a row without an Activity: the next comparison would take it for one deleted on
        // this phone and delete the server copy. Killed in between: the comparison finds the
        // same track on the server and sends nothing.
        const outcome = await d.restoredActivities.restore(copy.value);
        if (outcome === 'invalid') {
          skipped++;
          unreadable.push(item.activityId);
        } else {
          await d.repo.updateBackupForRestore({ ...item, version: copy.value.version }, (b) =>
            b.restoredFromServer(copy.value.version, copy.value.gapsCheckedAt, d.clock.now())
          );
          restored += outcome === 'restored' ? 1 : 0;
        }
      } else {
        skipped++; // deleted on the server meanwhile, or content this phone can't read
        unreadable.push(item.activityId);
      }
      restore = await d.repo.restoreItemDone(item.activityId, (r) => r.itemDone());
    }

    const homeCity = restore.toState().homeCity;
    if (homeCity) {
      // The server has this choice: record that first, so it is not sent back.
      await d.repo.saveRestore((_r, s) => s.homeCityRestored(homeCity.chosenAt));
      try {
        await d.homeCity.restore(homeCity);
      } catch (e) {
        if (!(e instanceof DomainError)) {
          throw e;
        }
        // A city this version's catalogue doesn't know: skipped (the Turfer can choose one again).
      }
    }
    const left = (await d.repo.restoreItems()).length;
    restore = await d.repo.saveRestore((r) => r.finish(left));
    await d.repo.declineRestore(unreadable); // not offered again: they would be skipped again
    onProgress?.({ done: restore.toState().done, total: restore.toState().total });
    return { kind: 'done', restored, skipped, backupOn: await adoptConsents(d, c.api) };
  }
}

/**
 * The server copy exists, so this account consented to backup: read its consents and turn backup
 * (and the Apple Health option) on to match. Unreadable consents change nothing. Returns whether
 * backup is on now.
 */
async function adoptConsents(d: CloudBackupDeps, api: ApiClient): Promise<boolean> {
  const r = await api.consents();
  if (!r.ok) {
    return (await d.repo.settings()).enabled;
  }
  const granted = (p: ConsentPurpose) => r.value.some((c) => c.purpose === p && c.granted);
  const s = await d.repo.updateSettings((x) => {
    x.adoptServerConsents({ cloudSync: granted('cloud-sync'), health: granted('apple-health-in-cloud-sync') });
  });
  return s.enabled;
}

function stopOf(code: string): 'offline' | 'server' | 'auth' {
  return code === 'offline' ? 'offline' : code === 'auth' ? 'auth' : 'server';
}
