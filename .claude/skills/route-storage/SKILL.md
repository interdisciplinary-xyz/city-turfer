---
name: route-storage
description: >-
  Use for "my activity disappeared", adding a column or table, a new migration, changing what's
  stored per point, delete or export, or any work in apps/mobile/src/platform/ (SQLite, migrations,
  outbox) or a context's sqlite-*-repository.ts. GPX export is planned.
---

# Route storage

SQLite (`expo-sqlite`) is the source of truth, local-first, **one database per user**
(`turftrack-<uid>.db`, opened in `getContainer()`, `apps/mobile/src/composition-root.ts`). Every
accepted point is committed to disk within one location batch of arriving.

Connection, migrations, outbox, jobs and diagnostics are in `apps/mobile/src/platform/`.
Repositories implement the domain ports in each context's `infrastructure/sqlite-*-repository.ts`.
Ports live with their domain: Recording in `apps/mobile/src/contexts/recording/domain/`; the core
contexts (Territory, Activity Log) in `packages/core/src/contexts/<ctx>/domain/`, imported by the
adapters through `@cityturfer/core/<ctx>/ports`.

## Schema (the live one is `apps/mobile/src/platform/migrations.ts`)

Tables are prefixed by owning context; a context never reads another context's tables.

- **Migration 1**
  - `sys_outbox` (platform): domain events awaiting dispatch (`type`, JSON `payload`,
    `processed_at`).
  - `rec_sessions` (Recording): one row per Recording Session; `status` plus `state`, a JSON
    snapshot of the aggregate (tail, totals, timers).
  - `rec_track_points` (Recording): accepted points of the live session. PK `(session_id, seq)`,
    `segment`, `t` (epoch ms from the fix), `lat`, `lon`, `alt`, `accuracy`, `speed`; WITHOUT ROWID.
  - `log_activities` (Activity Log): the summary: `distance_m`, `moving_s`, `elapsed_s`,
    `elev_gain_m`, `splits` (JSON), `bbox` (JSON `[w,s,e,n]`), `preview` (JSON simplified
    `[[lon,lat],…]`).
  - `log_track_points` (Activity Log): the Activity's track, same columns as `rec_track_points`,
    keyed `(activity_id, seq)`.
  - `ter_claims`, `ter_claim_cells` (Territory): Claims, the source of truth for turf: per activity,
    its cells and which were new.
  - `ter_cells` (Territory): the rebuildable Territory projection: `visits`, per-type counts,
    centroid `lat`/`lon` (indexed), `first_at`/`last_at`.
- **2** `sys_diagnostics` (platform): `kind` (launch, app-state, batch, task-error) + JSON `data`:
  counts and timings, **never coordinates**; pruned after 14 days.
- **3** `sys_jobs` (platform): one-off maintenance jobs already run (`runOnce`).
- **4** Activity Log: `log_activities.estimated_m`, `estimated_moving_s`, `gaps_checked_at`, and
  `log_gap_routes`: street-routed estimates across segment gaps (display only, never turf).
- **5** `sys_outbox` + `attempts`, `last_error`, `next_attempt_at`, `dead_lettered_at`: retries with
  backoff and dead letters.
- **6** Health Sync: `hs_state`, `hs_links` (Activity ↔ workout, no FK so a link outlives a deleted
  Activity), `hs_pending_imports`, `hs_pending_exports`.
- **7** `ter_home_city` (Territory): the Home City as a catalogue id only, never coordinates.
- **8** Cloud Backup: `cb_state` (settings and sync cursor; the device token is in secure store, not
  here) and `cb_activities` (per-Activity backup status and queued op, no FK so a delete can still
  be sent).

Rules:

- `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;` on open
  (`apps/mobile/src/platform/expo-database.ts`).
- Store **accepted** points only. Rejected fixes go nowhere; their counts go to `sys_diagnostics`.
- Multi-row inserts go through `insertMany` (`apps/mobile/src/platform/batch.ts`, chunks under
  SQLite's 999-parameter limit).

## Migrations (`apps/mobile/src/platform/migrations.ts`)

An ordered, append-only array of `{ version, sql }`. Each runs in a transaction, and
`sys_schema_version` is bumped in the same transaction. `migrate(db)` runs in `getContainer()`
before anything queries the database, so the UI and the headless background task both get a migrated
database. **Never edit a shipped migration.** Add a new one, add a case to
`apps/mobile/src/platform/__tests__/migrations.test.ts` (`migrate(db, upTo)` seeds an older schema),
and keep personal data out of new columns unless a context needs it. One-off data repairs are
`runOnce` jobs (`apps/mobile/src/platform/jobs.ts`, wired in `apps/mobile/src/wiring.ts`), not
migrations.

## Repositories (`apps/mobile/src/contexts/*/infrastructure/sqlite-*-repository.ts`)

Aggregate-shaped, not CRUD; screens never write SQL. A `save` writes the aggregate's state, any new
rows and its pulled domain events (`appendToOutbox`) in **one transaction**.

- `SqliteRecordingSessionRepository`: `getActive()`, `get(id)`, `save(session, newPoints)` (state
  upsert + new points + outbox; refuses to overwrite a session that already ended, via
  `session.assertMayReplace`; a discarded session's points are deleted in the same transaction),
  `pointsOf(id)`, `purgePoints(id)` (after `ActivityRecorded`: Activity Log owns the track now),
  `scrubClosedSessions()`. Point `seq` comes from the aggregate (`session.firstSeqOf(n)`), not from
  `MAX(seq)`.
- `SqliteActivityRepository`: `exists`, `get`, `save(activity, track?)`, `delete(activity)`,
  `list(limit, before?)` (keyset pagination on `started_at`; summary columns + `preview` only, never
  `log_track_points`), `trackOf(id)`, `overlapping(type, start, end)`, `saveCorrection`, gap-route
  methods (`idsWithUncheckedGaps`, `saveGapRoutes`, `gapRoutesOf`, `gapsCheckedAt`), `timeline()`,
  `allIds()`, `typeOf(id)`.
- `SqliteTerritoryRepository`: `claimExists`, `existingCells`, `saveClaim` (claim + cells +
  projection increment + outbox), `releaseClaim` (decrements, deletes cells at 0 visits),
  `cellsIn(bbox, types)`, `allCells()`, `claimOf(id)`. `SqliteHomeCityRepository`: `homeCityId`,
  `homeCityChoice`, `saveHomeCity`.
- Health Sync (`SqliteHealthSyncRepository`) and Cloud Backup (`SqliteBackupRepository`) follow the
  same pattern; their owners are the `apple-health` skill and api-engineer.

Performance: `trackOf` on a 7,000-point ride should return in < 100 ms; select only the columns you
need.

Deletion:

- Discard (the user cancels a recording) → `status = 'discarded'` and its points deleted in the same
  transaction.
- Finished activities are deleted only by explicit user action, with confirmation: the Activity and
  its track go in one transaction, and the `ActivityDeleted` event releases its Claim.

## GPX export (planned, not built)

`expo-file-system` and `expo-sharing` are not installed yet; the code belongs in Activity Log's
`infrastructure/`. GPX 1.1 with `<metadata><time>`, `<trk><name>`, `<type>`
(`walking|running|cycling`, the Strava-compatible names), and one `<trkseg>` per `segment`. Each
point carries `lat`/`lon` (7 decimals), `<ele>` and `<time>` in ISO 8601 UTC. Escape XML in the
name. Write it to the cache directory as `cityturfer-YYYY-MM-DD-type.gpx`, then call
`Sharing.shareAsync(uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx' })`.

Round-trip test: export a fixture-backed activity, parse it with `parseGpx` from
`apps/mobile/tools/lib/geo.mjs`, and assert the point count and distance match.

## Privacy

- Coordinates leave the device only through an explicit user export or share, or the opt-in cloud
  backup (Info › Cloud backup: consent first, our EU API, device token;
  `apps/mobile/src/contexts/cloud-backup`).
- Planned: "hide start/end" when sharing (trim the first and last 200 m of exports only; stored data
  stays untouched), and "Delete all data" (drop all rows, then `VACUUM`).
