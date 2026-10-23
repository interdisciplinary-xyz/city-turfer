import {
  bigint,
  boolean,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import type { CompactPoint, StoredGapRoute, StoredSummary } from '../backup/model';

/**
 * Server tables (Postgres via Drizzle). Multi-tenant from day one: `user_id` is the first column of
 * every key, and every query filters on it. Migrations are generated from this file
 * (`pnpm --filter @cityturfer/api run db:generate`) into apps/api/drizzle/ and committed.
 *
 * Personal data: activities (times, preview), tracks, gap routes and the Home City. Tombstones keep
 * only (user, id, deletedAt). Erasure (`DELETE /v1/me` and `user:delete`: `eraseAccount` in
 * ./store.ts) covers every table here; a new table hangs off `users` with ON DELETE CASCADE.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const seq = (name: string) => bigint(name, { mode: 'number' });

/** An account. `change_seq` is the per-user counter that orders the changes feed (row-locked per write). */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  displayName: text('display_name'),
  changeSeq: seq('change_seq').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  /** +1 whenever the user's turf projection changes (claim, release, rebuild, erase): the turf ETag. */
  turfVersion: seq('turf_version').notNull().default(0),
});

/** The latest decision per purpose (`cloud-sync`, `apple-health-in-cloud-sync`). */
export const consents = pgTable(
  'consents',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    granted: boolean('granted').notNull(),
    policyVersion: text('policy_version').notNull(),
    decidedAt: ts('decided_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.purpose] })]
);

/** An uploaded Activity with the summary the server computed with @cityturfer/core. */
export const activities = pgTable(
  'activities',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    /** When the name was last changed by `PATCH` (the phone's time): last write wins. */
    renamedAt: ts('renamed_at'),
    source: text('source').notNull(),
    startedAt: ts('started_at').notNull(),
    endedAt: ts('ended_at').notNull(),
    timeZone: text('time_zone'),
    resumedSegments: jsonb('resumed_segments').$type<number[] | null>(),
    trackHash: text('track_hash').notNull(),
    /** SHA-256 of the canonical upload (fields + trackHash): equal → the upload is a replay. */
    contentHash: text('content_hash').notNull(),
    summary: jsonb('summary').$type<StoredSummary>().notNull(),
    estimatedDistanceM: doublePrecision('estimated_distance_m').notNull().default(0),
    estimatedMovingS: integer('estimated_moving_s').notNull().default(0),
    version: integer('version').notNull(),
    updatedAt: ts('updated_at').notNull(),
    changeSeq: seq('change_seq').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('activities_user_seq').on(t.userId, t.changeSeq),
    index('activities_user_started').on(t.userId, t.startedAt.desc(), t.id.desc()),
  ]
);

/** Every point of an activity, compact `[lon, lat, t, segment, altitudeM | null]`, as uploaded. */
export const activityTracks = pgTable(
  'activity_tracks',
  {
    userId: text('user_id').notNull(),
    activityId: text('activity_id').notNull(),
    points: jsonb('points').$type<CompactPoint[]>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.activityId] }),
    foreignKey({ columns: [t.userId, t.activityId], foreignColumns: [activities.userId, activities.id] }).onDelete(
      'cascade'
    ),
  ]
);

/** The phone's street estimates across GPS gaps (display only, never turf). */
export const gapRoutes = pgTable(
  'gap_routes',
  {
    userId: text('user_id').notNull(),
    activityId: text('activity_id').notNull(),
    checkedAt: ts('checked_at').notNull(),
    routes: jsonb('routes').$type<StoredGapRoute[]>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.activityId] }),
    foreignKey({ columns: [t.userId, t.activityId], foreignColumns: [activities.userId, activities.id] }).onDelete(
      'cascade'
    ),
  ]
);

/** A deleted activity id: kept forever, delete wins (D5). No personal data beyond the id. */
export const tombstones = pgTable(
  'tombstones',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activityId: text('activity_id').notNull(),
    deletedAt: ts('deleted_at').notNull(),
    changeSeq: seq('change_seq').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.activityId] }), index('tombstones_user_seq').on(t.userId, t.changeSeq)]
);

/** The Home City: last write wins on `chosen_at` (the phone's time of the choice). */
export const homeCities = pgTable('home_cities', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cityId: text('city_id'),
  chosenAt: ts('chosen_at').notNull(),
  /** When the server stored the choice (`changedAt` in the feed). */
  recordedAt: ts('recorded_at').notNull(),
  changeSeq: seq('change_seq').notNull(),
});

// ---------------------------------------------------------------------------------------------
// Turf (Territory), derived on the server from the uploaded tracks with @cityturfer/core
// (docs/decisions/api-server-turf-2026-10-23.md). Never uploaded; rebuildable from the claims. Turf
// Cells (H3 res 11 ids) are location data: never logged, never in problem bodies.
// ---------------------------------------------------------------------------------------------

/** The Claim of one Activity: its unique Turf Cells. Goes with the activity (ON DELETE CASCADE). */
export const turfClaims = pgTable(
  'turf_claims',
  {
    userId: text('user_id').notNull(),
    activityId: text('activity_id').notNull(),
    type: text('type').notNull(),
    /** The activity's start (the Claim's time), not when the server claimed it. */
    claimedAt: ts('claimed_at').notNull(),
    cells: text('cells').array().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.activityId] }),
    foreignKey({ columns: [t.userId, t.activityId], foreignColumns: [activities.userId, activities.id] }).onDelete(
      'cascade'
    ),
  ]
);

/**
 * The turf projection: visits per type of every Turf Cell, and its canonical first claimer (D4: the
 * claim with the earliest `(claimed_at, activity_id COLLATE "C")`, whatever the upload order). No
 * coordinates (the grid derives them) and no decay (strength is computed on read).
 */
export const turfCells = pgTable(
  'turf_cells',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cell: text('cell').notNull(),
    walk: integer('walk').notNull().default(0),
    run: integer('run').notNull().default(0),
    cycle: integer('cycle').notNull().default(0),
    firstAt: ts('first_at').notNull(),
    firstActivityId: text('first_activity_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.cell] })]
);

// ---------------------------------------------------------------------------------------------
// Better Auth (email one-time codes + bearer sessions). Its own tables, prefixed `auth_`, mapped
// in src/identity/better-auth.ts. The Better Auth user id **is** `users.id` (no copy of the data);
// `users` rows of device-token callers have no `auth_users` row. JS keys are Better Auth's fields.
// ---------------------------------------------------------------------------------------------

export const authUsers = pgTable('auth_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/**
 * A signed-in phone (bearer token) or browser (cookie): `token` signed is the credential, `id` the
 * opaque id the sessions list shows. `expires_at` slides; a browser session never outlives
 * `absolute_expires_at` (null for phones). No IP or user agent is stored: Better Auth gets no
 * request headers, so `ip_address` and `user_agent` stay empty.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    client: text('client').notNull().default('phone'),
    absoluteExpiresAt: ts('absolute_expires_at'),
    token: text('token').notNull().unique(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
  },
  (t) => [index('auth_sessions_user').on(t.userId)]
);

/** Better Auth's linked accounts (unused by email codes; required by its schema). */
export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('auth_accounts_user').on(t.userId)]
);

/** Pending one-time codes: `value` is the encrypted code plus the attempt count (codeCipher). */
export const authVerifications = pgTable(
  'auth_verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('auth_verifications_identifier').on(t.identifier)]
);

/** Fixed-window counters of the auth rate limits. Keys are HMACs of the e-mail or IP, never plain. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    windowStartedAt: ts('window_started_at').notNull(),
    hits: integer('hits').notNull(),
  },
  (t) => [index('rate_limits_window').on(t.windowStartedAt)]
);

// ---------------------------------------------------------------------------------------------
// Data exports (GDPR art. 15 and 20) and the Postgres FileStorage adapter. Both hang off `users`
// (ON DELETE CASCADE), so erasing the account erases them.
// ---------------------------------------------------------------------------------------------

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => 'bytea' });

/** One export job. The download key is never stored: only its SHA-256 (`key_hash`). */
export const dataExports = pgTable(
  'data_exports',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    status: text('status').notNull(),
    requestedAt: ts('requested_at').notNull(),
    readyAt: ts('ready_at'),
    expiresAt: ts('expires_at'),
    downloadedAt: ts('downloaded_at'),
    keyHash: text('key_hash').unique(),
    fileKey: text('file_key'),
    byteSize: integer('byte_size'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('data_exports_user_requested').on(t.userId, t.requestedAt)]
);

/** FileStorage on Postgres (`bytea`): export zips until Vercel Blob. Expired rows are purged. */
export const storedFiles = pgTable(
  'stored_files',
  {
    key: text('key').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(),
    bytes: bytea('bytes').notNull(),
    createdAt: ts('created_at').notNull(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('stored_files_expires').on(t.expiresAt)]
);

export const schema = {
  users,
  consents,
  activities,
  activityTracks,
  gapRoutes,
  tombstones,
  homeCities,
  turfClaims,
  turfCells,
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
  rateLimits,
  dataExports,
  storedFiles,
};
