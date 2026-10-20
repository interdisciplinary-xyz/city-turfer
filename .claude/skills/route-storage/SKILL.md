---
name: route-storage
description:
  TurfTrack's local-first persistence with expo-sqlite — schema for activities and track points,
  migrations, repository functions, write patterns from the background task, query performance for
  long routes, deletion, and GPX 1.1 export (planned, not built). Use when touching
  apps/mobile/src/platform/ (database, migrations, outbox) or a context's sqlite-*-repository.ts,
  adding a column, changing what's stored per point, implementing history, delete, export or import,
  or debugging "my activity disappeared".
---

> **DDD mapping** (see `docs/poc-plan.md` §5): tables are owned per context — Recording:
> `rec_sessions`, `rec_track_points`; Activity Log: `log_activities`, `log_track_points`; platform:
> `sys_schema_version`, `sys_outbox`. Repositories implement domain ports in each context's
> `infrastructure/` (`sqlite-*-repository.ts`); connection, migrations and outbox are in
> `apps/mobile/src/platform/`. **The live schema is `apps/mobile/src/platform/migrations.ts`**; the
> single-table schema below is the original v1 column reference, not what ships. GPX export is not
> built yet; it belongs in Activity Log's `infrastructure/`.

# Route storage

SQLite is the source of truth. Every recorded point is committed to disk within one location batch
of arriving.

## Schema (v1)

```sql
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);

CREATE TABLE activities (
  id              TEXT PRIMARY KEY,                -- uuid (expo-crypto randomUUID)
  type            TEXT NOT NULL CHECK (type IN ('walk','run','cycle')),
  status          TEXT NOT NULL CHECK (status IN ('recording','paused','finished','discarded')),
  name            TEXT,
  notes           TEXT,
  started_at      INTEGER NOT NULL,                -- epoch ms
  ended_at        INTEGER,
  distance_m      REAL NOT NULL DEFAULT 0,         -- denormalised summary, recomputed on finish
  moving_s        INTEGER NOT NULL DEFAULT 0,
  elapsed_s       INTEGER NOT NULL DEFAULT 0,
  elev_gain_m     REAL,
  elev_loss_m     REAL,
  bbox            TEXT,                            -- JSON [minLat,minLon,maxLat,maxLon] for map fit
  preview         TEXT,                            -- encoded simplified polyline for the list thumbnail
  segment         INTEGER NOT NULL DEFAULT 0,      -- current segment, ++ on resume
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_activities_started ON activities(started_at DESC);
CREATE INDEX idx_activities_status ON activities(status);

CREATE TABLE points (
  activity_id     TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  segment         INTEGER NOT NULL,
  ts              INTEGER NOT NULL,                -- epoch ms from the fix, not Date.now()
  lat             REAL NOT NULL,
  lon             REAL NOT NULL,
  alt             REAL,
  accuracy        REAL,
  alt_accuracy    REAL,
  speed           REAL,                            -- m/s from the device, null if < 0
  heading         REAL,
  pressure        REAL,                            -- hPa, if barometer is available
  PRIMARY KEY (activity_id, seq)
) WITHOUT ROWID;
```

- `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;` on open.
- `seq` is `MAX(seq)+1`, computed inside the insert transaction, so concurrent task batches can't
  collide.
- Store **accepted** points only. Rejected fixes go nowhere, except a `tracking_log` table in dev
  builds.

## Migrations (apps/mobile/src/platform/migrations.ts)

An ordered, append-only array of `{ version, sql }`. Each runs in a transaction, and
`sys_schema_version` is bumped in the same transaction. `migrate(db)` runs in `getContainer()`
(`apps/mobile/src/composition-root.ts`) before anything queries the database, so the UI and the
headless background task both get a migrated database. **Never edit a shipped migration.** Add a new
one.

## Repositories (`apps/mobile/src/contexts/*/infrastructure/sqlite-*-repository.ts`)

Typed functions only; screens never write SQL. Minimum set: `createActivity(type)`,
`getActiveActivity()`, `appendPoints(activityId, points[])`, `setStatus(id, status)`,
`bumpSegment(id)`, `finishActivity(id)` (recomputes summary with `packages/core/src/shared-kernel`
and writes bbox + preview), `listActivities({ limit, before })` (keyset pagination on `started_at`),
`getActivity(id)`, `getPoints(id)`, `renameActivity`, `deleteActivity(id)`.

- `listActivities` must never select from `points`: the list reads only summary columns and
  `preview`.
- `getPoints` on a 7,000-point ride should return in < 100 ms. Select only the columns you need.
- Discard (a user cancels a recording) → `status = 'discarded'`, with a hard delete on next launch.
  Finished activities are deleted only by explicit user action, with confirmation.

## GPX export (planned, not built)

GPX 1.1 with `<metadata><time>`, `<trk><name>`, `<type>` (`walking|running|cycling`, the
Strava-compatible names), and one `<trkseg>` per `segment`. Each point carries `lat`/`lon` (7
decimals), `<ele>` and `<time>` in ISO 8601 UTC. Escape XML in the name. Write it to
`FileSystem.cacheDirectory` as `turftrack-YYYY-MM-DD-type.gpx`, then call
`Sharing.shareAsync(uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx' })`.

Round-trip test: export a fixture-backed activity, parse it with `parseGpx` from
`apps/mobile/tools/lib/geo.mjs`, and assert the point count and distance match.

## Privacy

- Coordinates never leave the device except through an explicit user export or share.
- Offer "hide start/end": when sharing, trim the first and last 200 m. Apply it to exports only;
  stored data stays untouched.
- "Delete all data" in Settings drops all rows and runs `VACUUM`.
