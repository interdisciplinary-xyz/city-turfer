/**
 * Platform-independent wiring of all bounded contexts for one user database.
 * Used by the composition root (with Expo adapters) and by integration tests
 * (with fakes). Contains no Expo imports.
 */
import { H3CellGrid } from '@cityturfer/core/h3';

import { API_BASE_URL, CLOUD_BACKUP_POLICY_VERSION } from '@/constants/api';
import {
  type ActivityDeleted,
  type ActivityDistanceEstimated,
  type ActivityRecorded,
  type ActivityTrackCorrected,
  createActivityLogApi,
  type GapRoutingEnvironment,
  type RouteEstimator,
} from '@/contexts/activity-log';
import { SqliteActivityRepository } from '@/contexts/activity-log/infrastructure/sqlite-activity-repository';
import {
  type ApiClientFactory,
  type CloudBackupDeps,
  createCloudBackupApi,
  type DeviceTokenStore,
} from '@/contexts/cloud-backup';
import { SqliteBackupRepository } from '@/contexts/cloud-backup/infrastructure/sqlite-backup-repository';
import { createHealthSyncApi, type HealthStore } from '@/contexts/health-sync';
import { SqliteHealthSyncRepository } from '@/contexts/health-sync/infrastructure/sqlite-health-sync-repository';
import { UNAVAILABLE_HEALTH_STORE } from '@/contexts/health-sync/infrastructure/unavailable-health-store';
import { createRecordingApi, SerialCommandExecutor, type SessionFinished } from '@/contexts/recording';
import type { LiveSessionNotifier, LocationTracker, PermissionGateway } from '@/contexts/recording/application/ports';
import { SqliteRecordingSessionRepository } from '@/contexts/recording/infrastructure/sqlite-recording-session-repository';
import { createTerritoryApi } from '@/contexts/territory';
import { SqliteHomeCityRepository } from '@/contexts/territory/infrastructure/sqlite-home-city-repository';
import { SqliteTerritoryRepository } from '@/contexts/territory/infrastructure/sqlite-territory-repository';
import type { Database } from '@/platform/database';
import { Diagnostics } from '@/platform/diagnostics';
import { runOnce } from '@/platform/jobs';
import { EventDispatcher, pruneOutbox } from '@/platform/outbox';
import { type Clock, type DomainEvent, type IdGenerator, systemClock } from '@/shared-kernel';

export interface DeviceAdapters {
  tracker: LocationTracker;
  permissions: PermissionGateway;
  notifier: LiveSessionNotifier;
  ids: IdGenerator;
  router: RouteEstimator;
  /** Setting, foreground check and pacing for the street router. Omitted: street estimation is off. */
  gapRouting?: GapRoutingEnvironment;
  /** Apple Health. Omitted: not available (Android, most tests). */
  health?: HealthStore;
  /** Is the app in the foreground? Omitted: always (tests). HealthKit work waits for it. */
  isForeground?: () => boolean;
  /** Cloud Backup's HTTP client and per-user token store. Omitted: no server (backup can't be turned on). */
  cloudBackup?: CloudBackupAdapters;
  /** The device's IANA time zone now (kept with each new Activity). Omitted: unknown. */
  timeZone?: () => string | null;
  clock?: Clock;
}

export interface CloudBackupAdapters {
  api: ApiClientFactory;
  tokens: (userId: string) => DeviceTokenStore;
  /** Default: API_BASE_URL. */
  serverUrl?: string;
}

/** No server configured (most tests): every request answers "offline", and there is never a token. */
const NO_CLOUD_BACKUP: CloudBackupAdapters = {
  api: () => {
    const offline = async () => ({ ok: false as const, failure: { kind: 'offline' as const } });
    return {
      setConsent: offline,
      changes: offline,
      putActivity: offline,
      activityVersion: offline,
      deleteActivity: offline,
      putGapRoutes: offline,
      putHomeCity: offline,
    };
  },
  tokens: () => ({ read: async () => null, save: async () => undefined, clear: async () => undefined }),
};

/** No setting given (e.g. tests that don't exercise gaps): never call the router. */
const GAP_ROUTING_OFF: GapRoutingEnvironment = {
  setting: { isEnabled: async () => false, setEnabled: async () => undefined },
  isForeground: () => false,
  wait: async () => undefined,
};

export function wire(userId: string, db: Database, a: DeviceAdapters) {
  const clock = a.clock ?? systemClock;
  const diagnostics = new Diagnostics(db);
  const dispatcher = new EventDispatcher(db, {
    now: () => clock.now(),
    // No payload or error message: they may carry coordinates.
    onDeadLetter: (d) => diagnostics.log('task-error', { code: 'outbox.dead-letter', ...d }),
  });
  const afterCommit = () => void dispatcher.dispatchPending();

  const recording = createRecordingApi({
    sessions: new SqliteRecordingSessionRepository(db),
    tracker: a.tracker,
    permissions: a.permissions,
    notifier: a.notifier,
    clock,
    ids: a.ids,
    afterCommit,
    // The UI and the background location task share this container, hence this queue.
    commands: new SerialCommandExecutor(),
  });

  const activityLog = createActivityLogApi({
    activities: new SqliteActivityRepository(db),
    finishedTracks: { trackOf: (id) => recording.finishedTrack.execute(id) },
    router: a.router,
    gapRouting: a.gapRouting ?? GAP_ROUTING_OFF,
    clock,
    afterCommit,
    timeZone: a.timeZone,
  });

  const territory = createTerritoryApi({
    repo: new SqliteTerritoryRepository(db),
    homeCities: new SqliteHomeCityRepository(db),
    grid: new H3CellGrid(),
    tracks: { trackOf: (id) => activityLog.trackQuery.execute(id) },
    clock,
    afterCommit,
  });

  const healthSync = createHealthSyncApi({
    store: a.health ?? UNAVAILABLE_HEALTH_STORE,
    repo: new SqliteHealthSyncRepository(db),
    activities: {
      importTrack: (input) => activityLog.importActivity.execute(input),
      detailOf: async (id) => {
        const d = await activityLog.detail.execute(id);
        return (
          d && { type: d.type, startedAt: d.startedAt, endedAt: d.endedAt, distanceM: d.distanceM, track: d.track }
        );
      },
      overlapping: (type, startedAt, endedAt) => activityLog.overlapping.execute(type, startedAt, endedAt),
    },
    clock,
    isForeground: a.isForeground ?? (() => true),
    onExportError: (code) => diagnostics.log('task-error', { code }),
  });

  const backupAdapters = a.cloudBackup ?? NO_CLOUD_BACKUP;
  const cloudBackupDeps: CloudBackupDeps = {
    repo: new SqliteBackupRepository(db),
    api: backupAdapters.api,
    tokens: backupAdapters.tokens(userId),
    activities: {
      timeline: () => activityLog.archive.timeline(),
      archiveOf: (id) => activityLog.archive.of(id),
    },
    homeCity: { choice: () => territory.homeCityChoice.execute() },
    clock,
    isForeground: a.isForeground ?? (() => true),
    defaultServerUrl: backupAdapters.serverUrl ?? API_BASE_URL,
    policyVersion: CLOUD_BACKUP_POLICY_VERSION,
    // Counts and codes only: no ids, names or coordinates.
    onRunFinished: (r) => {
      if (r.uploaded + r.deleted + r.failed + r.refused > 0 || r.error) {
        diagnostics.log('backup', { ...r });
      }
    },
  };
  const cloudBackup = createCloudBackupApi(cloudBackupDeps);

  // Context map (docs/poc-plan.md §3): Recording → Activity Log → Territory; Activity Log ↔ Health Sync.
  dispatcher.on('SessionFinished', (e: DomainEvent) => activityLog.recordFromSession.execute(e as SessionFinished));
  dispatcher.on('ActivityRecorded', async (e: DomainEvent) => {
    const ev = e as ActivityRecorded;
    await territory.claimFromActivity.execute(ev);
    await recording.purgeRecorded.execute(ev.activityId);
    await healthSync.exportActivity.execute(ev); // never throws: a failed export doesn't hold up the queue
  });
  dispatcher.on('ActivityDeleted', (e: DomainEvent) => territory.release.execute((e as ActivityDeleted).activityId));
  dispatcher.on('ActivityTrackCorrected', (e: DomainEvent) => territory.reclaim.execute(e as ActivityTrackCorrected));
  // Activity Log, Territory → Cloud Backup: local queueing only (no network inside the outbox).
  dispatcher.on('ActivityRecorded', (e: DomainEvent) => cloudBackup.queue.activityRecorded(e as ActivityRecorded));
  dispatcher.on('ActivityDeleted', (e: DomainEvent) => cloudBackup.queue.activityDeleted(e as ActivityDeleted));
  dispatcher.on('ActivityTrackCorrected', (e: DomainEvent) =>
    cloudBackup.queue.trackCorrected(e as ActivityTrackCorrected)
  );
  dispatcher.on('ActivityDistanceEstimated', (e: DomainEvent) =>
    cloudBackup.queue.gapRoutesEstimated(e as ActivityDistanceEstimated)
  );
  dispatcher.on('HomeCityChosen', () => cloudBackup.queue.homeCityChosen());

  // Best effort, outside the outbox (needs the network): route new recording gaps after every dispatch run.
  const estimateGaps = () => activityLog.estimateGapRoutes.execute().catch(() => 0);
  dispatcher.onChange(() => void estimateGaps());

  /** Sends queued backup work. Foreground only (RunBackup checks), never throws. */
  const backUp = (options?: { now?: boolean }) => cloudBackup.run.execute(options).catch(() => null);
  dispatcher.onChange(() => void backUp());

  /** Saves queued recordings to Apple Health, then imports new workouts. Foreground only. */
  const syncHealth = () =>
    healthSync.flushExports
      .execute()
      .then(() => healthSync.importWorkouts.execute())
      .catch((e) => {
        diagnostics.log('task-error', { code: 'health.import-failed', message: String(e) });
        return null;
      });

  /** Launch maintenance (before pending events are dispatched): one-off data repairs, then retention. */
  async function runMaintenance(): Promise<void> {
    const repaired = await runOnce(db, 'split-track-gaps-v1', () => activityLog.splitTrackGaps.execute());
    if (repaired) {
      diagnostics.log('maintenance', { job: 'split-track-gaps-v1', ...repaired });
    }
    const capped = await runOnce(db, 'cap-gap-moving-time-v1', () => activityLog.capEstimatedMovingTime.execute());
    if (capped) {
      diagnostics.log('maintenance', { job: 'cap-gap-moving-time-v1', ...capped });
    }
    const zoned = await runOnce(db, 'activity-time-zones-v1', () => activityLog.assignMissingTimeZones.execute());
    if (zoned) {
      diagnostics.log('maintenance', { job: 'activity-time-zones-v1', ...zoned });
    }
    const scrubbed = await runOnce(db, 'scrub-closed-sessions-v2', () => recording.scrubClosedSessions.execute());
    if (scrubbed) {
      diagnostics.log('maintenance', { job: 'scrub-closed-sessions-v2', ...scrubbed });
    }
    await pruneOutbox(db, clock.now());
  }

  /**
   * Launch housekeeping, foreground launches only (see composition root): repairs first, then finish
   * any work interrupted by a crash (also delivers the repairs' events), then route recording gaps.
   */
  async function runLaunchMaintenance(): Promise<void> {
    await runMaintenance().catch((e) => diagnostics.log('task-error', { code: 'maintenance', message: String(e) }));
    await dispatcher.dispatchPending();
    await estimateGaps();
    await syncHealth();
    await backUp();
  }

  /** Is a Recording Session active (recording, paused or auto-paused)? Gates sign-out. */
  const hasActiveSession = async () => (await recording.liveSnapshot.execute()) != null;

  return {
    userId,
    db,
    dispatcher,
    diagnostics,
    runMaintenance,
    runLaunchMaintenance,
    estimateGaps,
    syncHealth,
    backUp,
    hasActiveSession,
    recording,
    activityLog,
    territory,
    healthSync,
    cloudBackup,
  };
}

export type Container = ReturnType<typeof wire>;
