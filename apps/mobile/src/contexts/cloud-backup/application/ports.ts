import type { ActivityArchive } from '@/contexts/activity-log';
import type { HomeCityChoice } from '@/contexts/territory';
import type { Clock } from '@/shared-kernel';

import type { ActivityBackup } from '../domain/activity-backup';
import type { BackupSettings, ConsentPurpose } from '../domain/backup-settings';
import type { Restore, RestoreItem } from '../domain/restore';

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

/** An Activity as the changes feed lists it (no preview, no track). */
export interface ServerActivity {
  id: string;
  version: number;
  startedAt: number;
  name: string;
  /** SHA-256 of the canonical track (see canonicalTrackPoints). */
  trackHash: string;
}

/** The server's current version of one Activity and its name (GET /v1/activities/{id}). */
export interface ServerActivityHead {
  version: number;
  /** Null when the answer carried none (then the phone's name is sent). */
  name: string | null;
  /** When a PATCH last renamed it (the renaming phone's time); null: never. */
  renamedAt: number | null;
}

/** One page of the server's changes feed, reduced to what backup and restore need. */
export interface ChangesPage {
  /** Activities the server holds, in feed order. */
  upserted: ServerActivity[];
  /** Activities deleted on the server (tombstones). */
  deleted: string[];
  /** The last Home City choice on this page, if any. */
  homeCity: HomeCityChoice | null;
  nextCursor: string;
  hasMore: boolean;
}

/** An Activity's full server copy (GET /v1/activities/{id} + …/track), for Restore. */
export type ServerActivityCopy = ActivityArchive & { version: number; source: UploadSource };

/** Where an uploaded Activity came from (the server's `source`). */
export type UploadSource = 'recording' | 'apple-health';

/**
 * Port: the CityTurfer API (apps/api, contract 0.4.0), already authenticated. The adapter is the
 * anti-corruption layer: wire formats, headers and status codes stay inside it.
 */
export interface ApiClient {
  /** GET /v1/me: whose token this is. */
  me(): Promise<ApiResult<{ id: string }>>;
  setConsent(purpose: ConsentPurpose, granted: boolean, policyVersion: string): Promise<ApiResult<void>>;
  /** GET /v1/me/consents: the latest decision per purpose (purposes never decided are absent). */
  consents(): Promise<ApiResult<{ purpose: ConsentPurpose; granted: boolean }[]>>;
  /** GET /v1/sync/changes; `cursor` null: everything (the manifest). */
  changes(cursor: string | null): Promise<ApiResult<ChangesPage>>;
  /** PUT the Activity with its track; `ifMatchVersion` replaces that server version. */
  putActivity(
    activity: ActivityArchive,
    meta: { source: UploadSource; timeZone: string | null },
    ifMatchVersion: number | null
  ): Promise<ApiResult<{ version: number }>>;
  /**
   * GET /v1/activities/{id}: the server's current version of an Activity, with its name and when a
   * PATCH last renamed it (before a replacement, and after a 412/428) — so a PUT never overwrites a
   * newer rename from another phone.
   */
  activityVersion(activityId: string): Promise<ApiResult<ServerActivityHead>>;
  deleteActivity(activityId: string): Promise<ApiResult<void>>;
  /** PATCH the name; the server keeps the latest `renamedAt`. */
  renameActivity(activityId: string, name: string, renamedAt: number): Promise<ApiResult<{ version: number | null }>>;
  /** The whole server copy of one Activity (detail + track), for Restore. */
  activityCopy(activityId: string): Promise<ApiResult<ServerActivityCopy>>;
  /** Replaces the gap routes; an empty list means "checked, no gaps". */
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

/**
 * Port: how this profile reaches the server — the signed-in account's bearer token (Identity) or a
 * device token pasted in Developer tools. `accountId` null: ask the server (GET /v1/me). Read only
 * in the foreground; never logged.
 */
export interface BackupCredentials {
  current(): Promise<{ token: string; accountId: string | null } | null>;
}

/** Port: SHA-256 (lowercase hex) of a UTF-8 string. */
export type Sha256 = (text: string) => Promise<string>;

/** Port: Cloud Backup's own storage (cb_state, cb_activities). */
export interface BackupRepository {
  settings(): Promise<BackupSettings>;
  /** Atomic read-modify-write of the settings row; returns the result. */
  updateSettings(change: (s: BackupSettings) => void): Promise<BackupSettings>;
  /** Atomic: switches to another server/account; a real switch forgets every Activity's row. */
  useAccount(key: string): Promise<BackupSettings>;
  /** Atomic: settings change + forget the rows of the Activities the server erased. */
  forgetServerCopies(
    change: (s: BackupSettings) => void,
    erased: (activityId: string) => boolean
  ): Promise<BackupSettings>;
  backupOf(activityId: string): Promise<ActivityBackup | null>;
  /** Every Activity's row (also those no longer on the phone). */
  backups(): Promise<ActivityBackup[]>;
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

  // --- Restore (cb_restore, cb_restore_items) ---
  restore(): Promise<Restore>;
  /** Atomic: the restore's state + its (ordered) items. */
  startRestore(restore: Restore, items: readonly RestoreItem[]): Promise<void>;
  /** What is still to bring back, oldest first. */
  restoreItems(): Promise<RestoreItem[]>;
  /** Atomic: the Activity's backup row from the server copy (written before it is imported). */
  updateBackupForRestore(item: RestoreItem, change: (b: ActivityBackup) => void): Promise<void>;
  /** Atomic: the item is handled (removed) and the restore's progress saved. */
  restoreItemDone(activityId: string, change: (r: Restore) => void): Promise<Restore>;
  /** Atomic: the restore's state (e.g. finished) + settings (e.g. the Home City the server has). */
  saveRestore(change: (r: Restore, s: BackupSettings) => void): Promise<Restore>;
  /** Server Activities not to offer again ("Not now", or skipped by a restore). */
  declinedRestoreIds(): Promise<string[]>;
  declineRestore(activityIds: readonly string[]): Promise<void>;
  /** Activities deleted on this phone (ids only; kept across account switches): never restored. */
  deletedHereIds(): Promise<string[]>;
  rememberDeletedHere(activityId: string): Promise<void>;
}

/** Port: Activity Log's archive query (its public API, adapted in wiring). */
export interface ActivitySource {
  timeline(): Promise<{ id: string; startedAt: number }[]>;
  archiveOf(activityId: string): Promise<ActivityArchive | null>;
}

/** Port: Territory's Home City decision. */
export interface HomeCitySource {
  choice(): Promise<HomeCityChoice | null>;
  /** Restore: applies an earlier choice (an older one never replaces a newer one). */
  restore(choice: HomeCityChoice): Promise<void>;
}

/** Port: Activity Log's restore (origin `restore`: claimed as turf, never exported or re-uploaded). */
export interface ActivitySink {
  restore(copy: ActivityArchive): Promise<'restored' | 'exists' | 'invalid'>;
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
  /** False for profiles that never talk to the API (the demo profile): no request of any kind. */
  available: boolean;
  repo: BackupRepository;
  api: ApiClientFactory;
  /** The Developer tools device token (until the Turfer signs in with a code). */
  tokens: DeviceTokenStore;
  credentials: BackupCredentials;
  sha256: Sha256;
  activities: ActivitySource;
  homeCity: HomeCitySource;
  restoredActivities: ActivitySink;
  /** Is a Recording Session active? Restore never runs during one. */
  isRecording: () => Promise<boolean>;
  clock: Clock;
  /** False on headless launches: no network work then (the recording task must never wait on it). */
  isForeground: () => boolean;
  defaultServerUrl: string;
  policyVersion: string;
  /** Uploads in flight at once (≤ 2). */
  concurrency?: number;
  onRunFinished?: (report: BackupRunReport) => void;
}
