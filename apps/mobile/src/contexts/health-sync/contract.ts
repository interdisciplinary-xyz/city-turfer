// Published language of the Health Sync context (types only).
import type { ImportReport } from './domain/health-sync-state';

export interface HealthSyncStatus {
  /** Apple Health exists here (iOS build with HealthKit). False on Android. */
  available: boolean;
  connected: boolean;
  importEnabled: boolean;
  exportEnabled: boolean;
  importing: boolean;
  lastImport: ImportReport | null;
}

export type { ImportReport };
