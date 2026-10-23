import type { TurfRepository } from '../territory/ports';
import type {
  ActivityRecord,
  ActivityTypeName,
  ChangeRecord,
  CompactPoint,
  ConsentRecord,
  GapRoutesRecord,
  HomeCityRecord,
  TombstoneRecord,
  UserRecord,
} from './model';

/** Reads scoped to one user: every query filters on the user id (object-level authorisation). */
export interface UserReader {
  /**
   * The user's turf projection, on the same connection or transaction as this reader: inside
   * `write` after `lock()`, claims commit with the activity they come from.
   */
  readonly turf: TurfRepository;
  user(): Promise<UserRecord | null>;
  consents(): Promise<ConsentRecord[]>;
  activity(id: string): Promise<ActivityRecord | null>;
  tombstone(id: string): Promise<TombstoneRecord | null>;
  track(id: string): Promise<CompactPoint[] | null>;
  gapRoutes(id: string): Promise<GapRoutesRecord | null>;
  /** Tracks of several activities in one query (export). */
  tracksOf(ids: readonly string[]): Promise<Map<string, CompactPoint[]>>;
  /** Gap routes of several activities in one query (export). */
  gapRoutesOf(ids: readonly string[]): Promise<Map<string, GapRoutesRecord>>;
  homeCity(): Promise<HomeCityRecord | null>;
  /** Newest first by (startedAt, id); `before` is the last item of the previous page. */
  listActivities(q: {
    limit: number;
    type?: ActivityTypeName;
    before?: { startedAt: number; id: string };
  }): Promise<ActivityRecord[]>;
  /** Activities, tombstones and the Home City whose change seq is above `afterSeq`, in seq order. */
  changesSince(afterSeq: number, limit: number): Promise<ChangeRecord[]>;
  /** The user's change counter (highest seq handed out). */
  currentSeq(): Promise<number>;
}

/** One transaction scoped to one user. */
export interface UserWriter extends UserReader {
  /**
   * Locks the user's row until commit: all writes of one user are serialised (no lost updates).
   * Re-creates a missing row (a device-token user erased on another function instance).
   */
  lock(): Promise<void>;
  /** Next change seq of this user (after `lock`). */
  nextSeq(): Promise<number>;
  putConsent(consent: ConsentRecord): Promise<void>;
  insertActivity(activity: ActivityRecord, points: CompactPoint[]): Promise<void>;
  /** Replaces the row; `points` replaces the track when given. */
  updateActivity(activity: ActivityRecord, points?: CompactPoint[]): Promise<void>;
  /** Deletes the activity with its track and gap routes. */
  deleteActivity(id: string): Promise<void>;
  putTombstone(tombstone: TombstoneRecord): Promise<void>;
  /** Replaces the gap routes; null removes them. */
  putGapRoutes(activityId: string, routes: GapRoutesRecord | null): Promise<void>;
  putHomeCity(homeCity: HomeCityRecord): Promise<void>;
  /**
   * Erases the server copy without leaving tombstones or feed entries: `apple-health` removes the
   * Apple Health activities (`hk-…` or source `apple-health`) with their tracks and gap routes;
   * `all` removes every activity, track, gap route and the Home City. Existing tombstones stay (ids
   * and times, no location data: delete wins across a withdrawal, D5). Either way the
   * user's stored export files go and their exports expire (they copy that data). Turf follows:
   * `all` deletes every claim and Turf Cell, `apple-health` rebuilds the cells from the claims that
   * remain (nothing derived from Apple Health stays, first claimers included). Returns how many
   * activities went.
   */
  eraseBackup(scope: 'apple-health' | 'all'): Promise<number>;
}

/** Port: the server's storage (Postgres via Drizzle in production, PGlite in tests and dev). */
export interface BackupStore {
  read(userId: string): UserReader;
  write<T>(userId: string, fn: (tx: UserWriter) => Promise<T>): Promise<T>;
  /**
   * EraseAccount: deletes every row of the user in one transaction — data, consents, tombstones,
   * the Home City, exports, the Better Auth user with its sessions and pending codes. Idempotent.
   */
  eraseAccount(userId: string): Promise<void>;
  /** Creates the user on first sight; fills a missing email or display name. */
  ensureUser(user: UserRecord): Promise<void>;
  /** True when the database answers. */
  ping(): Promise<boolean>;
}
