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
  type ActivityRenamed,
  type ActivityTrackCorrected,
  createActivityLogApi,
  type DefaultNameWords,
  type GapRoutingEnvironment,
  type RouteEstimator,
} from '@/contexts/activity-log';
import { SqliteActivityRepository } from '@/contexts/activity-log/infrastructure/sqlite-activity-repository';
import {
  type ApiClientFactory,
  type BackupCredentials,
  type CloudBackupDeps,
  createCloudBackupApi,
  type DeviceTokenStore,
  type Sha256,
} from '@/contexts/cloud-backup';
import { SqliteBackupRepository } from '@/contexts/cloud-backup/infrastructure/sqlite-backup-repository';
import { createHealthSyncApi, type HealthStore } from '@/contexts/health-sync';
import { SqliteHealthSyncRepository } from '@/contexts/health-sync/infrastructure/sqlite-health-sync-repository';
import { UNAVAILABLE_HEALTH_STORE } from '@/contexts/health-sync/infrastructure/unavailable-health-store';
import { DEMO_PROFILE_ID } from '@/contexts/identity';
import { createRecordingApi, SerialCommandExecutor, type SessionFinished } from '@/contexts/recording';
import type { LiveSessionNotifier, LocationTracker, PermissionGateway } from '@/contexts/recording/application/ports';
import { SqliteRecordingSessionRepository } from '@/contexts/recording/infrastructure/sqlite-recording-session-repository';
import { createTerritoryApi, type HomeCityChosen } from '@/contexts/territory';
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
  /**
   * Words of a new Activity's default name in the language active at creation (recordings, Apple
   * Health and demo imports). Omitted: core's English.
   */
  defaultNameWords?: () => DefaultNameWords | Promise<DefaultNameWords>;
  clock?: Clock;
}

export interface CloudBackupAdapters {
  api: ApiClientFactory;
  /** The Developer tools device token of a profile. */
  tokens: (userId: string) => DeviceTokenStore;
  /**
   * How a profile reaches the server (its signed-in account). Omitted: its device token, whose
   * account the server names (GET /v1/me).
   */
  credentials?: (userId: string, deviceToken: DeviceTokenStore) => BackupCredentials;
  sha256: Sha256;
  /** The built-in server; it must be the identity server (the account's session token goes only there). Default: API_BASE_URL. */
  serverUrl?: string;
}

/** A device token only (no signed-in account): the server says whose it is. */
const deviceTokenCredentials = (tokens: DeviceTokenStore): BackupCredentials => ({
  current: async () => {
    const token = await tokens.read();
    return token ? { token, accountId: null } : null;
  },
});

/** No server configured (most tests): every request answers "offline", and there is never a token. */
const NO_CLOUD_BACKUP: CloudBackupAdapters = {
  api: () => {
    const offline = async () => ({ ok: false as const, failure: { kind: 'offline' as const } });
    return {
      me: offline,
      setConsent: offline,
      consents: offline,
      changes: offline,
      putActivity: offline,
      activityVersion: offline,
      deleteActivity: offline,
      renameActivity: offline,
      activityCopy: offline,
      putGapRoutes: offline,
      putHomeCity: offline,
    };
  },
  tokens: () => ({ read: async () => null, save: async () => undefined, clear: async () => undefined }),
  sha256: async () => '',
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
  /** Is a restore from the cloud backup running? (Cloud Backup is wired below.) */
  let restoring: () => boolean = () => false;

  /** Is a Recording Session active (recording, paused or auto-paused)? Gates sign-out and restore. */
  const hasActiveSession = async () => (await recording.liveSnapshot.execute()) != null;

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
    defaultNameWords: a.defaultNameWords,
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
    // Apple Health import waits while a restore brings the backup back (no duplicates meanwhile).
    isForeground: () => (a.isForeground?.() ?? true) && !restoring(),
    onExportError: (code) => diagnostics.log('task-error', { code }),
  });

  const backupAdapters = a.cloudBackup ?? NO_CLOUD_BACKUP;
  const deviceToken = backupAdapters.tokens(userId);
  const cloudBackupDeps: CloudBackupDeps = {
    // Every profile with a server configured; it sends nothing until it has credentials (LP1).
    available: a.cloudBackup != null,
    // Only the demo profile uploads its generated `demo-…` history (LP3).
    demoProfile: userId === DEMO_PROFILE_ID,
    repo: new SqliteBackupRepository(db),
    api: backupAdapters.api,
    tokens: deviceToken,
    credentials: backupAdapters.credentials?.(userId, deviceToken) ?? deviceTokenCredentials(deviceToken),
    sha256: backupAdapters.sha256,
    activities: {
      timeline: () => activityLog.archive.timeline(),
      archiveOf: (id) => activityLog.archive.of(id),
    },
    homeCity: {
      choice: () => territory.homeCityChoice.execute(),
      restore: (choice) => territory.chooseHomeCity.execute(choice.cityId, choice.chosenAt),
    },
    restoredActivities: { restore: (copy) => activityLog.restoreActivity.execute(copy) },
    isRecording: () => hasActiveSession().catch(() => true), // unknown: don't restore under a recording
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
  restoring = () => cloudBackup.restore.isRunning;

  // Context map (docs/poc-plan.md §3): Recording → Activity Log → Territory; Activity Log ↔ Health Sync.
  dispatcher.on('SessionFinished', (e: DomainEvent) => activityLog.recordFromSession.execute(e as SessionFinished));
  dispatcher.on('ActivityRecorded', async (e: DomainEvent) => {
    const ev = e as ActivityRecorded;
    await territory.claimFromActivity.execute(ev);
    await recording.purgeRecorded.execute(ev.activityId);
    await healthSync.exportActivity.execute(ev); // never throws: a failed export doesn't hold up the queue
  });
  // Cloud Backup restore → Health Sync: a restored Apple Health import stays deleted once deleted here.
  dispatcher.on('ActivityRecorded', (e: DomainEvent) =>
    healthSync.rememberRestoredImport.execute(e as ActivityRecorded)
  );
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
  dispatcher.on('ActivityRenamed', (e: DomainEvent) => cloudBackup.queue.activityRenamed(e as ActivityRenamed));
  dispatcher.on('HomeCityChosen', (e: DomainEvent) => cloudBackup.queue.homeCityChosen(e as HomeCityChosen));

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
    // Throws while the phone's zone can't be read: not marked done (retried next launch), and the
    // jobs after it still run.
    const zoned = await runOnce(db, 'activity-time-zones-v1', () => activityLog.assignMissingTimeZones.execute()).catch(
      (e) => {
        diagnostics.log('task-error', { code: 'maintenance', message: String(e) });
        return null;
      }
    );
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
