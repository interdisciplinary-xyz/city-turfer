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

/** Sums over a set of activities: recorded (the core's summary) and estimated over GPS gaps, apart. */
export interface ActivitySums {
  count: number;
  distanceM: number;
  estimatedDistanceM: number;
  movingS: number;
  estimatedMovingS: number;
}

/** A user whose activities are not all claimed yet, with how many are not. */
export interface TurfBacklogEntry {
  userId: string;
  /** Activities without a claim that have a track to claim from (what the backfill works on). */
  unclaimed: number;
  /**
   * Activities without a claim and without a track (no `activity_tracks` row, or no points): they
   * cannot be claimed, so the backfill reports them as skipped and never retries them. Uploads
   * always carry ≥ 2 points, so any count here is a repair case (runbook: the diagnostic SQL).
   */
  untracked: number;
}

/** A user with a turf projection (claims or Turf Cells): what `turf:rebuild` walks. */
export interface TurfUserEntry {
  userId: string;
}

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
    /** `startedAt >= startedAfter` (epoch ms). */
    startedAfter?: number;
    /** `startedAt < startedBefore` (epoch ms). */
    startedBefore?: number;
  }): Promise<ActivityRecord[]>;
  /** Per type: how many activities, and the sums of their recorded and estimated distance and moving time. */
  activityTotals(): Promise<Partial<Record<ActivityTypeName, ActivitySums>>>;
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
  /**
   * Background jobs (catch-up, backfill, rebuild): locks the user's row until commit like `lock`,
   * but never re-creates it. False when the row is gone (the account was erased meanwhile): the job
   * must skip the user and write nothing.
   */
  lockExisting(): Promise<boolean>;
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
  /**
   * Users with activities that have no turf claim (backfill, catch-up), by user id (JS order), at
   * most `limit`, after `afterUserId`; only `userId` when given. Counts only, across users.
   */
  turfBacklog(q: { limit: number; afterUserId?: string; userId?: string }): Promise<TurfBacklogEntry[]>;
  /**
   * Users with claims or Turf Cells (`turf:rebuild`), by user id (JS order), at most `limit`, after
   * `afterUserId`; only `userId` when given.
   */
  turfUsers(q: { limit: number; afterUserId?: string; userId?: string }): Promise<TurfUserEntry[]>;
}
