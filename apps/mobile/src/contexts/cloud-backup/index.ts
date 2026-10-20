// Public API of the Cloud Backup context: one-way backup of Activities to the CityTurfer API.
import type { CloudBackupDeps } from './application/ports';
import { QueueBackupChanges } from './application/queue-changes';
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
  const run = new RunBackup(deps);
  return {
    status: new GetBackupStatus(deps, () => run.isRunning),
    saveToken: new SaveDeviceToken(deps),
    removeToken: new RemoveDeviceToken(deps),
    useServer: new UseBackupServer(deps),
    enable: new EnableBackup(deps),
    disable: new DisableBackup(deps),
    includeHealth: new IncludeHealthWorkouts(deps),
    run,
    /** Outbox handlers (local only, never the network). */
    queue: new QueueBackupChanges(deps),
  };
}
export type CloudBackupApi = ReturnType<typeof createCloudBackupApi>;
export type {
  ActivitySource,
  ApiClient,
  ApiClientFactory,
  ApiFailure,
  ApiResult,
  BackupRunReport,
  ChangesPage,
  CloudBackupDeps,
  DeviceTokenStore,
  HomeCitySource,
  ServerAccess,
} from './application/ports';
export type { BackupRunResult } from './application/run-backup';
export type * from './contract';
