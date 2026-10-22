import {
  bigint,
  boolean,
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
 * only (user, id, deletedAt). Erasure (`DELETE /v1/me`, planned) must cover every table here.
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

/** A signed-in phone: the bearer token is `token` (sliding expiry). No IP or user agent is stored. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
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

/** Pending one-time codes: `value` is the SHA-256 of the code plus the attempt count. */
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

export const schema = {
  users,
  consents,
  activities,
  activityTracks,
  gapRoutes,
  tombstones,
  homeCities,
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
  rateLimits,
};
