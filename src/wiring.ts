/**
 * Platform-independent wiring of all bounded contexts for one user database.
 * Used by the composition root (with Expo adapters) and by integration tests
 * (with fakes). Contains no Expo imports.
 */
import { type ActivityDeleted, type ActivityRecorded, createActivityLogApi } from '@/contexts/activity-log';
import { SqliteActivityRepository } from '@/contexts/activity-log/infrastructure/SqliteActivityRepository';
import { createRecordingApi, type SessionFinished } from '@/contexts/recording';
import type { LiveSessionNotifier, LocationTracker, PermissionGateway } from '@/contexts/recording/application/ports';
import { SqliteRecordingSessionRepository } from '@/contexts/recording/infrastructure/SqliteRecordingSessionRepository';
import { createTerritoryApi } from '@/contexts/territory';
import { H3CellGrid } from '@/contexts/territory/infrastructure/H3CellGrid';
import { SqliteTerritoryRepository } from '@/contexts/territory/infrastructure/SqliteTerritoryRepository';
import type { Database } from '@/platform/database';
import { Diagnostics } from '@/platform/diagnostics';
import { EventDispatcher } from '@/platform/outbox';
import { type Clock, type DomainEvent, type IdGenerator, systemClock } from '@/shared-kernel';

export interface DeviceAdapters {
  tracker: LocationTracker;
  permissions: PermissionGateway;
  notifier: LiveSessionNotifier;
  ids: IdGenerator;
  clock?: Clock;
}

export function wire(userId: string, db: Database, a: DeviceAdapters) {
  const dispatcher = new EventDispatcher(db);
  const afterCommit = () => void dispatcher.dispatchPending();
  const clock = a.clock ?? systemClock;

  const recording = createRecordingApi({
    sessions: new SqliteRecordingSessionRepository(db),
    tracker: a.tracker,
    permissions: a.permissions,
    notifier: a.notifier,
    clock,
    ids: a.ids,
    afterCommit,
  });

  const activityLog = createActivityLogApi({
    activities: new SqliteActivityRepository(db),
    finishedTracks: { trackOf: (id) => recording.finishedTrack.execute(id) },
    clock,
    afterCommit,
  });

  const territory = createTerritoryApi({
    repo: new SqliteTerritoryRepository(db),
    grid: new H3CellGrid(),
    tracks: { trackOf: (id) => activityLog.trackQuery.execute(id) },
    clock,
    afterCommit,
  });

  // Context map (docs/poc-plan.md §3): Recording → Activity Log → Territory.
  dispatcher.on('SessionFinished', (e: DomainEvent) => activityLog.recordFromSession.execute(e as SessionFinished));
  dispatcher.on('ActivityRecorded', async (e: DomainEvent) => {
    const ev = e as ActivityRecorded;
    await territory.claimFromActivity.execute(ev);
    await recording.purgeRecorded.execute(ev.activityId);
  });
  dispatcher.on('ActivityDeleted', (e: DomainEvent) => territory.release.execute((e as ActivityDeleted).activityId));

  return { userId, db, dispatcher, diagnostics: new Diagnostics(db), recording, activityLog, territory };
}

export type Container = ReturnType<typeof wire>;
