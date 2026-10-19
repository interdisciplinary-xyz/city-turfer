// Public API of the Health Sync context: Apple Health import and export.
import type { HealthSyncDeps } from './application/ports';
import {
  ConnectAppleHealth,
  DisconnectAppleHealth,
  ExportActivityToHealth,
  FlushHealthExports,
  GetHealthSyncStatus,
  ImportHealthWorkouts,
  SetHealthSyncDirections,
} from './application/use-cases';

export function createHealthSyncApi(deps: HealthSyncDeps) {
  const importWorkouts = new ImportHealthWorkouts(deps);
  const flushExports = new FlushHealthExports(deps);
  return {
    status: new GetHealthSyncStatus(deps, () => importWorkouts.isRunning),
    connect: new ConnectAppleHealth(deps),
    disconnect: new DisconnectAppleHealth(deps),
    setDirections: new SetHealthSyncDirections(deps),
    importWorkouts,
    flushExports,
    exportActivity: new ExportActivityToHealth(deps, flushExports),
  };
}
export type HealthSyncApi = ReturnType<typeof createHealthSyncApi>;
export type { ActivityForHealth, ActivityGateway, HealthStore, HealthSyncDeps } from './application/ports';
export type { ExportResult } from './application/use-cases';
export type * from './contract';
export type { HealthRoutePoint, HealthWorkout, HealthWorkoutToSave } from './domain/health-workout';
export { isImportedFromHealth } from './domain/health-workout';
