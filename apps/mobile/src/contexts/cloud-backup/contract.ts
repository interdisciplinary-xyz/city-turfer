// Published language of the Cloud Backup context (types only).
import type { BackupErrorCode } from './domain/backup-settings';

/** What the Info screen's Cloud backup card shows. */
export interface BackupStatus {
  /** False for profiles that never back up (the demo profile). */
  available: boolean;
  enabled: boolean;
  healthIncluded: boolean;
  /** The phone can reach the server: a signed-in account or a device token (values never exposed). */
  hasToken: boolean;
  /** A Developer tools device token is saved on this phone. */
  hasDeviceToken: boolean;
  /** Activities with changes not on the server yet (0 while backup is off). */
  unsynced: number;
  /** The server in use (the built-in one or the testing override). */
  serverUrl: string;
  serverUrlOverridden: boolean;
  /** Activities whose current version is on the server, of `total` that may be backed up. */
  backedUp: number;
  total: number;
  /** Activities the server refused (too large or invalid). */
  refused: number;
  running: boolean;
  lastRunAt: number | null;
  lastError: BackupErrorCode | null;
}

/** Result of a switch or token action: ok, or why the server could not be told. */
export type BackupCommandResult = { kind: 'ok' } | { kind: 'failed'; error: BackupErrorCode };

export type { BackupErrorCode };
