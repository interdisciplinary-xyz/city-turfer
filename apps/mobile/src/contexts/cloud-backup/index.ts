// Public API of the Cloud Backup context: one-way backup of Activities to the CityTurfer API.
import type { CloudBackupDeps } from './application/ports';
import { QueueBackupChanges } from './application/queue-changes';
import { DismissRestoreOffer, GetRestoreOffer, RestoreFromBackup } from './application/restore';
import { RunBackup } from './application/run-backup';
import {
  DisableBackup,
  EnableBackup,
  GetBackupStatus,
  IncludeHealthWorkouts,
  RemoveDeviceToken,
  SaveDeviceToken,
  UseBackupServer,
} from './application/settings-use-cases';

export function createCloudBackupApi(deps: CloudBackupDeps) {
  // Backup runs wait while a restore runs (or one was interrupted); a restore waits for a run.
  // eslint-disable-next-line prefer-const -- assigned below: the two wait for each other
  let run: RunBackup;
  const restore = new RestoreFromBackup(deps, () => run.whenIdle());
  run = new RunBackup(deps, () => restore.isRunning);
  const restoreOffer = new GetRestoreOffer(deps);
  return {
    status: new GetBackupStatus(deps, () => run.isRunning),
    saveToken: new SaveDeviceToken(deps),
    removeToken: new RemoveDeviceToken(deps),
    useServer: new UseBackupServer(deps),
    enable: new EnableBackup(deps, () => run.whenIdle()),
    disable: new DisableBackup(deps),
    includeHealth: new IncludeHealthWorkouts(deps, () => run.whenIdle()),
    run,
    restoreOffer,
    dismissRestore: new DismissRestoreOffer(deps, restoreOffer),
    restore,
    /** Outbox handlers (local only, never the network). */
    queue: new QueueBackupChanges(deps),
  };
}
export type CloudBackupApi = ReturnType<typeof createCloudBackupApi>;
export type {
  ActivitySink,
  ActivitySource,
  ApiClient,
  ApiClientFactory,
  ApiFailure,
  ApiResult,
  BackupCredentials,
  BackupRunReport,
  ChangesPage,
  CloudBackupDeps,
  DeviceTokenStore,
  HomeCitySource,
  ServerAccess,
  ServerActivityCopy,
  Sha256,
} from './application/ports';
export type { RestoreOffer, RestoreProgress, RestoreResult } from './application/restore';
export type { BackupRunResult } from './application/run-backup';
export type * from './contract';
