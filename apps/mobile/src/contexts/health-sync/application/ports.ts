import type { ActivityType, Clock, TrackPoint } from '@/shared-kernel';

import type {
  HealthLink,
  HealthSyncState,
  ImportReport,
  PendingExport,
  PendingImport,
} from '../domain/health-sync-state';
import type { HealthRoutePoint, HealthWorkout, HealthWorkoutToSave } from '../domain/health-workout';

/**
 * Port: Apple Health (HealthKit). The iOS adapter wraps @kingstinct/react-native-healthkit; on
 * Android and in builds without HealthKit `available` is false and nothing else is called.
 */
export interface HealthStore {
  readonly available: boolean;
  /** Shows Apple's permission sheet (only the first time). HealthKit never says whether reading was allowed. */
  requestAccess(): Promise<void>;
  /** Walking, hiking, running and cycling workouts added since `anchor` (null: from the beginning). */
  workoutsSince(anchor: string | null, limit: number): Promise<{ workouts: HealthWorkout[]; anchor: string }>;
  /** The workout's route; empty when it has none or reading routes isn't allowed. */
  routeOf(healthUuid: string): Promise<HealthRoutePoint[]>;
  /** Saves a workout with its route. Rejects when the workout itself could not be saved. */
  saveWorkout(workout: HealthWorkoutToSave): Promise<{ healthUuid: string; routeSaved: boolean }>;
  /** The workout CityTurfer already saved for this Activity (found by our metadata key), if any. */
  findSavedWorkout(activityId: string): Promise<string | null>;
}

/** Port: Health Sync's own storage (per user database). */
export interface HealthSyncRepository {
  state(): Promise<HealthSyncState>;
  saveState(patch: Partial<HealthSyncState>): Promise<void>;
  linkOf(activityId: string): Promise<HealthLink | null>;
  linkOfHealthUuid(healthUuid: string): Promise<HealthLink | null>;
  saveLink(link: HealthLink): Promise<void>;
  pendingImports(): Promise<PendingImport[]>;
  savePendingImport(p: PendingImport): Promise<void>;
  removePendingImport(healthUuid: string): Promise<void>;
  pendingExports(): Promise<PendingExport[]>;
  /** Adds the Activity to the export queue (no-op when it is already queued). */
  queueExport(activityId: string): Promise<void>;
  saveExportAttempt(activityId: string, attempts: number): Promise<void>;
  removePendingExport(activityId: string): Promise<void>;
}

/** What Health Sync needs of an Activity to save it to Apple Health. */
export interface ActivityForHealth {
  type: ActivityType;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  track: TrackPoint[];
}

/** Port: the Activity Log (its public API, adapted in wiring). */
export interface ActivityGateway {
  /** Creates an Activity from a track (it then claims turf like any other). False: it already exists. */
  importTrack(input: { id: string; type: ActivityType; points: TrackPoint[] }): Promise<boolean>;
  detailOf(activityId: string): Promise<ActivityForHealth | null>;
  /** Activities of this type whose time range intersects the given one. */
  overlapping(
    type: ActivityType,
    startedAt: number,
    endedAt: number
  ): Promise<{ id: string; startedAt: number; endedAt: number }[]>;
}

export interface HealthSyncDeps {
  store: HealthStore;
  repo: HealthSyncRepository;
  activities: ActivityGateway;
  clock: Clock;
  /** False on headless launches: HealthKit work then waits for the foreground. */
  isForeground: () => boolean;
  /** Export failures never throw (they would hold up the event queue); they are reported here. */
  onExportError?: (code: string) => void;
}

export type { HealthLink, HealthSyncState, ImportReport, PendingExport, PendingImport };
