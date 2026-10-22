import { type ActivityType, DomainError } from '@/shared-kernel';

import type { HealthSyncStatus } from '../contract';
import type { ImportReport } from '../domain/health-sync-state';
import {
  activityTypeFor,
  importedActivityId,
  isSameOuting,
  routeFromTrack,
  trackPointsFromRoute,
  workoutKindFor,
} from '../domain/health-workout';
import type { HealthSyncDeps } from './ports';

/** Workouts per Apple Health query. The anchor is saved after each page, so a big first import resumes. */
export const IMPORT_PAGE_SIZE = 25;
/** Workouts without a route yet (Apple Watch still syncing) are retried for this long after they end. */
export const IMPORT_RETRY_WINDOW_MS = 3 * 86_400_000;
/** A recording that still can't be saved to Health after this many tries is given up on. */
export const MAX_EXPORT_ATTEMPTS = 5;

export class GetHealthSyncStatus {
  constructor(
    private readonly d: HealthSyncDeps,
    private readonly importing: () => boolean
  ) {}
  async execute(): Promise<HealthSyncStatus> {
    const s = await this.d.repo.state();
    return {
      available: this.d.store.available,
      connected: s.connectedAt != null,
      importEnabled: s.importEnabled,
      exportEnabled: s.exportEnabled,
      importing: this.importing(),
      lastImport: s.lastImport,
    };
  }
}

/** Shows Apple's permission sheet and turns on import and export. */
export class ConnectAppleHealth {
  constructor(private readonly d: HealthSyncDeps) {}
  async execute(): Promise<void> {
    if (!this.d.store.available) {
      throw new DomainError('health.unavailable');
    }
    await this.d.store.requestAccess();
    await this.d.repo.saveState({ connectedAt: this.d.clock.now(), importEnabled: true, exportEnabled: true });
  }
}

/** Stops syncing. Apple Health permissions can only be withdrawn in the Health app. */
export class DisconnectAppleHealth {
  constructor(private readonly d: HealthSyncDeps) {}
  async execute(): Promise<void> {
    await this.d.repo.saveState({ connectedAt: null });
  }
}

export class SetHealthSyncDirections {
  constructor(private readonly d: HealthSyncDeps) {}
  async execute(patch: { importEnabled?: boolean; exportEnabled?: boolean }): Promise<void> {
    await this.d.repo.saveState(patch);
  }
}

type ImportOutcome = 'imported' | 'known' | 'duplicate' | 'no-route' | 'failed';

/**
 * Imports walks, hikes, runs and rides from Apple Health as Activities (which then claim turf).
 * Skips workouts CityTurfer wrote, workouts already imported (or imported and later deleted), and
 * outings already in CityTurfer from another source. Workouts whose route isn't readable yet are
 * retried on later syncs for a few days. One run at a time: a second caller joins the running one.
 */
export class ImportHealthWorkouts {
  private running: Promise<ImportReport | null> | null = null;
  private readonly listeners = new Set<(imported: number) => void>();

  constructor(private readonly d: HealthSyncDeps) {}

  get isRunning(): boolean {
    return this.running != null;
  }

  /** `full`: scan Apple Health from the beginning (Import now), not just what is new since last time. */
  execute(opts: { full?: boolean; onProgress?: (imported: number) => void } = {}): Promise<ImportReport | null> {
    const listener = opts.onProgress;
    if (listener) {
      this.listeners.add(listener);
    }
    if (!this.running) {
      this.running = this.run(opts.full ?? false).finally(() => {
        this.running = null;
        this.listeners.clear();
      });
    }
    return this.running;
  }

  private async active(): Promise<boolean> {
    const s = await this.d.repo.state();
    return this.d.store.available && s.connectedAt != null && s.importEnabled && this.d.isForeground();
  }

  private async run(full: boolean): Promise<ImportReport | null> {
    if (!(await this.active())) {
      return null;
    }
    const n = { imported: 0, withoutRoute: 0, duplicates: 0, skipped: 0 };
    const count = (o: ImportOutcome) => {
      if (o === 'imported') {
        n.imported++;
        this.listeners.forEach((l) => l(n.imported));
      } else if (o === 'duplicate') {
        n.duplicates++;
      } else if (o === 'no-route') {
        n.withoutRoute++;
      } else {
        n.skipped++;
      }
    };

    // 1. Workouts that had no route (or failed) last time.
    const now = this.d.clock.now();
    for (const p of await this.d.repo.pendingImports()) {
      if (now - p.endedAt > IMPORT_RETRY_WINDOW_MS) {
        await this.d.repo.removePendingImport(p.healthUuid);
        continue;
      }
      const outcome = await this.importOne(p.healthUuid, p.type, p.startedAt, p.endedAt);
      if (outcome === 'no-route' || outcome === 'failed') {
        await this.d.repo.savePendingImport({ ...p, attempts: p.attempts + 1 });
      } else {
        await this.d.repo.removePendingImport(p.healthUuid);
        count(outcome);
      }
    }

    // 2. New workouts since the anchor (or all of them).
    let anchor = full ? null : (await this.d.repo.state()).anchor;
    for (;;) {
      if (!(await this.active())) {
        break; // disconnected, switched off or sent to the background mid-import
      }
      const page = await this.d.store.workoutsSince(anchor, IMPORT_PAGE_SIZE);
      for (const w of page.workouts) {
        const type = activityTypeFor(w.kind);
        if (!type || w.fromCityTurfer) {
          n.skipped++;
          continue;
        }
        const outcome = await this.importOne(w.uuid, type, w.startedAt, w.endedAt);
        if ((outcome === 'no-route' || outcome === 'failed') && now - w.endedAt <= IMPORT_RETRY_WINDOW_MS) {
          await this.d.repo.savePendingImport({
            healthUuid: w.uuid,
            type,
            startedAt: w.startedAt,
            endedAt: w.endedAt,
            attempts: 1,
          });
        }
        count(outcome);
      }
      anchor = page.anchor;
      await this.d.repo.saveState({ anchor });
      // Pages may come back short (deleted samples count towards the limit): stop only when empty.
      if (page.workouts.length === 0) {
        break;
      }
    }
    const report: ImportReport = { at: this.d.clock.now(), ...n };
    await this.d.repo.saveState({ lastImport: report });
    return report;
  }

  private async importOne(
    uuid: string,
    type: ActivityType,
    startedAt: number,
    endedAt: number
  ): Promise<ImportOutcome> {
    try {
      if (await this.d.repo.linkOfHealthUuid(uuid)) {
        return 'known';
      }
      const others = await this.d.activities.overlapping(type, startedAt, endedAt);
      if (others.some((a) => isSameOuting(a, { startedAt, endedAt }))) {
        return 'duplicate';
      }
      const points = trackPointsFromRoute(await this.d.store.routeOf(uuid));
      if (points.length < 2) {
        return 'no-route';
      }
      const id = importedActivityId(uuid);
      await this.d.activities.importTrack({ id, type, points });
      await this.d.repo.saveLink({
        activityId: id,
        healthUuid: uuid,
        direction: 'import',
        at: this.d.clock.now(),
        routeSaved: true,
      });
      return 'imported';
    } catch {
      return 'failed';
    }
  }
}

export type ExportResult = 'queued' | 'exported' | 'skipped';

/**
 * Saves queued recordings to Apple Health with their routes. Foreground only (HealthKit writes and
 * route building can fail while the phone is locked). Before saving, asks Health whether this
 * Activity was already saved (the app may have died before the link was stored), so a workout is
 * never written twice. Never throws.
 */
export class FlushHealthExports {
  private running: Promise<number> | null = null;

  constructor(private readonly d: HealthSyncDeps) {}

  execute(): Promise<number> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async run(): Promise<number> {
    let exported = 0;
    try {
      const s = await this.d.repo.state();
      if (!this.d.store.available || s.connectedAt == null || !s.exportEnabled || !this.d.isForeground()) {
        return 0;
      }
      for (const p of await this.d.repo.pendingExports()) {
        try {
          if (await this.exportOne(p.activityId)) {
            exported++;
          }
          await this.d.repo.removePendingExport(p.activityId);
        } catch (err) {
          this.d.onExportError?.(err instanceof DomainError ? err.code : 'health.export-failed');
          if (p.attempts + 1 >= MAX_EXPORT_ATTEMPTS) {
            await this.d.repo.removePendingExport(p.activityId);
          } else {
            await this.d.repo.saveExportAttempt(p.activityId, p.attempts + 1);
          }
        }
      }
    } catch {
      this.d.onExportError?.('health.export-failed');
    }
    return exported;
  }

  /** True when a new workout was written. */
  private async exportOne(activityId: string): Promise<boolean> {
    if (await this.d.repo.linkOf(activityId)) {
      return false;
    }
    const link = (healthUuid: string, routeSaved: boolean) =>
      this.d.repo.saveLink({ activityId, healthUuid, direction: 'export', at: this.d.clock.now(), routeSaved });
    const already = await this.d.store.findSavedWorkout(activityId);
    if (already) {
      await link(already, true);
      return false;
    }
    const a = await this.d.activities.detailOf(activityId);
    if (!a) {
      return false; // deleted meanwhile
    }
    const saved = await this.d.store.saveWorkout({
      activityId,
      kind: workoutKindFor(a.type),
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      distanceM: a.distanceM,
      route: routeFromTrack(a.track),
    });
    await link(saved.healthUuid, saved.routeSaved);
    if (!saved.routeSaved) {
      this.d.onExportError?.('health.route-not-saved');
    }
    return true;
  }
}

/**
 * Handles ActivityRecorded: queues a newly recorded Activity for Apple Health and, in the
 * foreground, saves it right away. Never throws (it runs inside the event queue).
 */
export class ExportActivityToHealth {
  constructor(
    private readonly d: HealthSyncDeps,
    private readonly flush: FlushHealthExports
  ) {}

  /** Only new recordings: imports and Activities restored from the cloud backup are never exported. */
  async execute(e: { activityId: string; at: number; origin?: string }): Promise<ExportResult> {
    try {
      if ((e.origin ?? 'recording') !== 'recording' || !this.d.store.available) {
        return 'skipped';
      }
      const s = await this.d.repo.state();
      // Only activities recorded after connecting: not the whole history when someone connects.
      if (s.connectedAt == null || !s.exportEnabled || e.at < s.connectedAt) {
        return 'skipped';
      }
      if (await this.d.repo.linkOf(e.activityId)) {
        return 'skipped';
      }
      await this.d.repo.queueExport(e.activityId);
      if (!this.d.isForeground()) {
        return 'queued';
      }
      return (await this.flush.execute()) > 0 ? 'exported' : 'queued';
    } catch {
      this.d.onExportError?.('health.export-failed');
      return 'skipped';
    }
  }
}
