import type { ActivityArchive } from '@/contexts/activity-log';
import type { HomeCityChoice } from '@/contexts/territory';
import type { Clock } from '@/shared-kernel';

import type { ActivityBackup } from '../domain/activity-backup';
import type { BackupSettings, ConsentPurpose } from '../domain/backup-settings';

/**
 * Why a request failed, in the backup's terms (the adapter maps HTTP to these; nothing here knows
 * about status codes):
 * `auth` token refused · `consent` no backup consent on the server · `gone` deleted on the server
 * (tombstone) · `precondition` our version is stale or missing · `not-found` · `too-large` ·
 * `rejected` invalid content (`code` from the server's catalogue) · `offline` no answer ·
 * `unavailable` the server failed, is busy or doesn't offer this yet · `outdated` app too old.
 */
export type ApiFailure =
  | { kind: 'auth' | 'consent' | 'gone' | 'precondition' | 'not-found' | 'too-large' | 'offline' | 'outdated' }
  | { kind: 'rejected'; code: string }
  | { kind: 'unavailable'; reason: 'server' | 'not-ready' | 'busy' };

export type ApiResult<T> = { ok: true; value: T } | { ok: false; failure: ApiFailure };

/** One page of the server's changes feed, reduced to what a one-way backup needs. */
export interface ChangesPage {
  /** Activities the server holds, with their version, in feed order. */
  upserted: { id: string; version: number }[];
  /** Activities deleted on the server (tombstones). */
  deleted: string[];
  nextCursor: string;
  hasMore: boolean;
}

/** Where an uploaded Activity came from (the server's `source`). */
export type UploadSource = 'recording' | 'apple-health';

/**
 * Port: the CityTurfer API (apps/api, contract 0.2.0), already authenticated. The adapter is the
 * anti-corruption layer: wire formats, headers and status codes stay inside it.
 */
export interface ApiClient {
  setConsent(purpose: ConsentPurpose, granted: boolean, policyVersion: string): Promise<ApiResult<void>>;
  /** GET /v1/sync/changes; `cursor` null: everything (the manifest). */
  changes(cursor: string | null): Promise<ApiResult<ChangesPage>>;
  /** PUT the Activity with its track; `ifMatchVersion` replaces that server version. */
  putActivity(
    activity: ActivityArchive,
    meta: { source: UploadSource; timeZone: string | null },
    ifMatchVersion: number | null
  ): Promise<ApiResult<{ version: number }>>;
  /** The server's current version of an Activity (after a 412). */
  activityVersion(activityId: string): Promise<ApiResult<{ version: number }>>;
  deleteActivity(activityId: string): Promise<ApiResult<void>>;
  putGapRoutes(
    activityId: string,
    checkedAt: number,
    routes: ActivityArchive['gapRoutes']
  ): Promise<ApiResult<{ version: number | null }>>;
  putHomeCity(choice: HomeCityChoice): Promise<ApiResult<void>>;
}

export interface ServerAccess {
  baseUrl: string;
  token: string;
}

/** Builds an ApiClient for a server and token (the token is never stored by the client). */
export type ApiClientFactory = (access: ServerAccess) => ApiClient;

/** Port: the secret device token of the signed-in user (expo-secure-store). Never logged. */
export interface DeviceTokenStore {
  read(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** Port: Cloud Backup's own storage (cb_state, cb_activities). */
export interface BackupRepository {
  settings(): Promise<BackupSettings>;
  /** Atomic read-modify-write of the settings row; returns the result. */
  updateSettings(change: (s: BackupSettings) => void): Promise<BackupSettings>;
  backupOf(activityId: string): Promise<ActivityBackup | null>;
  /** Atomic read-modify-write of one Activity's row (created when missing). */
  updateBackup(activityId: string, startedAt: number, change: (b: ActivityBackup) => void): Promise<ActivityBackup>;
  /** Like updateBackup for many Activities, in one transaction. */
  updateBackups(
    items: readonly { id: string; startedAt: number }[],
    change: (b: ActivityBackup) => void
  ): Promise<void>;
  /** Activities with work queued (due or waiting for a retry), oldest first. */
  withWork(): Promise<ActivityBackup[]>;
  /** Ids whose server copy is current. */
  backedUpIds(): Promise<string[]>;
  /** Ids the server refused (too large, invalid). */
  refusedIds(): Promise<string[]>;
}

/** Port: Activity Log's archive query (its public API, adapted in wiring). */
export interface ActivitySource {
  timeline(): Promise<{ id: string; startedAt: number }[]>;
  archiveOf(activityId: string): Promise<ActivityArchive | null>;
}

/** Port: Territory's Home City decision. */
export interface HomeCitySource {
  choice(): Promise<HomeCityChoice | null>;
}

/** Counts and codes of a finished run, for diagnostics (never ids, names or coordinates). */
export interface BackupRunReport {
  uploaded: number;
  deleted: number;
  failed: number;
  refused: number;
  error: string | null;
}

export type { ConsentPurpose };

export interface CloudBackupDeps {
  repo: BackupRepository;
  api: ApiClientFactory;
  tokens: DeviceTokenStore;
  activities: ActivitySource;
  homeCity: HomeCitySource;
  clock: Clock;
  /** False on headless launches: no network work then (the recording task must never wait on it). */
  isForeground: () => boolean;
  defaultServerUrl: string;
  policyVersion: string;
  /** The device's IANA time zone, or null when unknown. */
  timeZone: () => string | null;
  /** Uploads in flight at once (≤ 2). */
  concurrency?: number;
  onRunFinished?: (report: BackupRunReport) => void;
}
