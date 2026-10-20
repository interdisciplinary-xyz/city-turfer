// Published language of the Cloud Backup context (types only).
import type { BackupErrorCode } from './domain/backup-settings';

/** What the Info screen's Cloud backup card shows. */
export interface BackupStatus {
  enabled: boolean;
  healthIncluded: boolean;
  /** A device token is saved on this phone (its value is never exposed). */
  hasToken: boolean;
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
