/** What Health Sync remembers per user (one row) and per synced Activity (one link each). */

/** Summary of the last import run, shown in Settings. */
export interface ImportReport {
  readonly at: number;
  readonly imported: number;
  /** Walks, runs and rides without a usable route (e.g. treadmill, indoor): turf needs a track. */
  readonly withoutRoute: number;
  /** Already in CityTurfer: the same outing recorded here or imported from another app. */
  readonly duplicates: number;
  /**
   * Ended before Apple Health was connected: left in Apple Health. Absent in reports saved before
   * v0.15.0.
   */
  readonly beforeStart?: number;
  /** Not importable: written by CityTurfer, already imported, or failed. */
  readonly skipped: number;
}

/**
 * The import starts when Apple Health is connected: a workout is imported only if it ends at or
 * after that moment, so one still going on at connect counts. Older ones stay in Apple Health.
 */
export function endsAfterConnect(endedAt: number, connectedAt: number): boolean {
  return endedAt >= connectedAt;
}

/**
 * The report to keep as the last import. A sync since the anchor that found nothing to tell (nothing
 * imported, already here, without a route or from before connecting) keeps the previous report, so
 * Import now's "from before you connected" count doesn't turn into a bare "0 workouts added" on the
 * next foreground sync. A full scan (Import now) always replaces it.
 */
export function lastImportAfter(previous: ImportReport | null, latest: ImportReport, full: boolean): ImportReport {
  const foundNothing =
    latest.imported === 0 && latest.duplicates === 0 && latest.withoutRoute === 0 && !latest.beforeStart;
  return !full && previous && foundNothing ? previous : latest;
}

/**
 * A workout to try again on the next sync: its route wasn't there yet (Apple Watch still syncing,
 * route permission given later) or reading it failed. Dropped once the workout is older than the
 * retry window.
 */
export interface PendingImport {
  readonly healthUuid: string;
  readonly type: 'walk' | 'run' | 'cycle';
  readonly startedAt: number;
  readonly endedAt: number;
  readonly attempts: number;
}

/** A recording waiting to be saved to Apple Health (only ever done in the foreground). */
export interface PendingExport {
  readonly activityId: string;
  readonly attempts: number;
}

export interface HealthSyncState {
  /** When the user connected Apple Health; null = not connected. */
  readonly connectedAt: number | null;
  readonly importEnabled: boolean;
  readonly exportEnabled: boolean;
  /** Apple Health's position after the last imported page: the next import continues from here. */
  readonly anchor: string | null;
  readonly lastImport: ImportReport | null;
}

export const INITIAL_HEALTH_SYNC_STATE: HealthSyncState = {
  connectedAt: null,
  importEnabled: true,
  exportEnabled: true,
  anchor: null,
  lastImport: null,
};

/**
 * One Activity ↔ one Apple Health workout. Kept when the Activity is deleted, so a deleted import is
 * never imported again and a deleted recording is never exported again.
 */
export interface HealthLink {
  readonly activityId: string;
  readonly healthUuid: string;
  readonly direction: 'import' | 'export';
  readonly at: number;
  /** Export only: false when the workout was saved but its route was not. */
  readonly routeSaved: boolean;
}
