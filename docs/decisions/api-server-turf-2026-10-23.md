---
status: canonical
verified: 2026-10-23
owner: founder
scope:
  [
    apps/api/src/territory,
    apps/api/src/backup,
    apps/api/src/db/schema.ts,
    apps/api/src/db/store.ts,
    apps/api/drizzle/0005_turf.sql,
  ]
summary:
  The server derives turf from uploaded tracks with core's own use cases, in the upload's locked
  transaction — tables turf_claims (cells as text[]) and turf_cells (per-type counts, canonical
  first claimer D4, COLLATE "C"), users.turf_version, no decay stored, future starts deferred,
  export excluded for v0.10.0; phase 1 (projection), routes are phase 2
---

# Server turf projection (phase 1)

The founder asked for server turf in v0.10.0 (so the web portal can show it). This record covers
**phase 1**: the projection the server keeps. The turf routes (`/v1/turf/summary`, `/v1/turf/cells`,
`/v1/turf/claims/{activityId}`), the backfill script, the catch-up in the retention cron, activity
totals and contract 0.6.0 are phase 2. Plan: rn-architect, 2026-10-23. Closes D10 of
`docs/decisions/api-sync-2026-10-20.md`.

## What the server does

- **Same rules as the phone.** `TurfProjection` (`apps/api/src/territory/projection.ts`) runs
  Territory's use cases from `createTurfApi(deps)` (`@cityturfer/core/territory`) over a Postgres
  `TerritoryRepository` (`apps/api/src/territory/drizzle-territory-repository.ts`) and the H3 grid
  (`@cityturfer/core/h3`, built once in `apps/api/src/wiring.ts`). Cells, claims and strength come
  from the core; nothing is re-implemented in SQL beyond counting and ordering.
- **In the write's transaction, after `lock()`.** The activity and its claim commit together:
  - upload create → claim; replay (same content hash) → returns before any turf work;
  - replace → reclaim when the track hash, the type or the start changed; otherwise an idempotent
    claim (a no-op when the claim exists; claims an activity that never was, e.g. a deferred one);
    renames and gap routes never touch turf (gap routes never count);
  - delete → release **before** the activity row goes (the cascade would lose the cell list);
    unknown or tombstoned ids change nothing;
  - `cloud-sync` withdrawn → every claim and Turf Cell of the user deleted;
  - `apple-health-in-cloud-sync` withdrawn → the `hk-…` activities go (their claims cascade), then
    every cell is rebuilt from the remaining claims, first claimers included: nothing derived from
    Apple Health remains (B5);
  - account erasure → cascade from `users` (cells) and `activities` (claims).
- **Version.** `users.turf_version` + 1 on every change of the projection (claim, release, rebuild,
  erase); a replay leaves it alone. Phase 2 uses it for the cells ETag and cursor.

## Tables (migration `0005_turf`)

| Table         | Key                      | Columns                                                                                                       |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `turf_claims` | `(user_id, activity_id)` | `type`, `claimed_at` (= activity start), `cells text[]` (sorted, unique); FK → `activities` ON DELETE CASCADE |
| `turf_cells`  | `(user_id, cell)`        | `walk`, `run`, `cycle` visit counts, `first_at`, `first_activity_id`; FK → `users` ON DELETE CASCADE          |
| `users`       |                          | `turf_version bigint` (new column)                                                                            |

No coordinates (the grid derives centroids), no `last_at`, no decay: strength is
`1 − exp(−visits/3)` computed on read and only the summary's "new this week/month" depends on now.
The primary keys are the only indexes (no GIN): the perf test does not need one.

## D4, canonical first claimer

A cell is _new_ for the claim with the earliest `(claimed_at, activity_id)`, whatever the upload
order. `saveClaim` upserts the cells and replaces `first_*` when the new claim sorts first;
`releaseClaim` deletes the claim and recomputes its cells from the remaining claims (counts,
`first_at` and the first claimer). The id tie-break is **JS string order**: every comparison carries
`COLLATE "C"`. PGlite's default collation is C, Neon's databases may be linguistic (en_US): without
the explicit collation `a1…` would beat `B7…` on Neon and lose on the phone. The tests prove it by
switching the id columns to ICU `und-x-icu` (fails without `COLLATE "C"`).

**Known gap, phone vs server.** For the same operations the phone and the server agree on the
summary and on every cell (counts, first time) — G2, `turf-parity.json` in core, asserted by core,
the phone and the API. They do **not** agree on a claim's "new" cells (`isNew`, `newCellCount`,
`newAreaKm2`): the phone fixes them at arrival and never revises them (a late `hk-…` walk that is
older than everything: phone 0 new, D4 5; a same-instant tie: the phone credits the first arrival).
A mobile test pins this as a known gap. **The web must take "new turf" from the server
(`/v1/turf/claims/…`, phase 2), never assume it equals the phone's card.**

## Future starts (`claim.in-future`)

`Claim.fromTrack` refuses a start more than 60 s after the server's clock; the upload has no such
check (Activity Log has no rule for it). The projection catches **only** that code: the activity is
stored (2xx) and stays unclaimed; `BackupService.catchUpTurf(userId, limit)` (`claimMissing`) claims
it once due, and so does any later replace. Any other turf failure fails the upload (500, nothing
logged but the error class; the phone retries) — swallowing more would hide drift.

## Why

- **Arrays for claim cells**, not a `(user, activity, cell)` row table: a claim is written and
  deleted whole, never queried by cell except to recompute; one row per claim keeps a heavy user
  (1,000 activities, ~50k cells) at ~3–6 MB of claims instead of ~10× the rows, and release is one
  `DELETE … RETURNING cells`. Arrays are bound as **one** Postgres array literal (`textArray()`):
  Drizzle's `sql` template expands a JS array into one parameter per element, which a 40k-point
  claim would push past Postgres' 65,535 bind parameters. Checked on PGlite (`unnest($1::text[])`,
  50k elements in ~20 ms).
- **A stored projection, not lazy on read.** Reads (web turf map, summary) must be cheap and
  cacheable by version; a lazy backfill on the first read would run a user's whole history inside a
  GET (seconds on Vercel, cold starts) and race concurrent writes without the user lock. Backfill of
  activities uploaded before this release is an explicit, resumable script (phase 2, run by the
  founder) plus the bounded catch-up in the daily cron.
- **No events on the server.** `afterCommit` is a no-op and the Claim's `TurfClaimed` events are
  dropped: the server has no outbox and nothing subscribes.

Rejected: a new `TurfStore` port (core's `TerritoryRepository` already fits); `first_at` kept from a
deleted claim (the phone's old drift); storing strength or decay; lazy backfill on read; catching
every turf error.

## Export

Turf is **not** in the data export (`data.json`) for v0.10.0 (founder default): it is derived from
the activities, which are exported, and is rebuilt from them. Erasure covers both tables
(`apps/api/src/__tests__/erase.test.ts`).

## Measured (PGlite, local, 2026-10-23)

A 40k-point upload on a user with ~49k cells: claim 163 ms, release 46 ms, whole upload 236 ms;
reading all cells 262 ms. Not measured on Neon or Vercel.
