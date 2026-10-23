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
    apps/api/drizzle/0006_turf_claim_track_hash.sql,
    apps/api/src/routes/territory.ts,
    apps/api/src/schemas/territory.ts,
    apps/api/scripts/turf-backfill.ts,
    apps/api/scripts/turf-rebuild.ts,
  ]
summary:
  The server derives turf from uploaded tracks with core's own use cases, in the upload's locked
  transaction — tables turf_claims (cells as text[]) and turf_cells (per-type counts, canonical
  first claimer D4, COLLATE "C"), users.turf_version, no decay stored, future starts deferred,
  export excluded for v0.10.0; phase 2 serves it (contract 0.6.0) — every cell paged with a
  version-bound cursor and ETag/304 (no-store), summary, claims, activity totals — plus a resumable
  backfill script that skips trackless activities, a bounded catch-up in the daily cron, and
  turf:rebuild for the repair after a rollback (stale cells and claims replaced in place)
---

# Server turf projection and reads

The founder asked for server turf in v0.10.0 (so the web portal can show it). **Phase 1** is the
projection the server keeps (below); **phase 2** serves it (contract 0.6.0, "Reads"), backfills the
activities uploaded before ("Backfill") and adds activity totals. Plan: rn-architect, 2026-10-23.
Closes D10 of `docs/decisions/api-sync-2026-10-20.md`.

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

## Tables (migrations `0005_turf`, `0006_turf_claim_track_hash`)

| Table         | Key                      | Columns                                                                                                                                                         |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turf_claims` | `(user_id, activity_id)` | `type`, `claimed_at` (= activity start), `cells text[]` (sorted, unique), `track_hash` (the activity's when claimed, 0006); FK → `activities` ON DELETE CASCADE |
| `turf_cells`  | `(user_id, cell)`        | `walk`, `run`, `cycle` visit counts, `first_at`, `first_activity_id`; FK → `users` ON DELETE CASCADE                                                            |
| `users`       |                          | `turf_version bigint` (new column)                                                                                                                              |

No coordinates (the grid derives centroids), no `last_at`, no decay: strength is
`1 − exp(−visits/3)` computed on read and only the summary's "new this week/month" depends on now.
The primary keys are the only indexes (no GIN): the perf test does not need one.

## D4, canonical first claimer

A cell is _new_ for the claim with the earliest `(claimed_at, activity_id)`, whatever the upload
order. `saveClaim` upserts the cells and replaces `first_*` when the new claim sorts first;
`releaseClaim` deletes the claim and recomputes its cells from the remaining claims (counts,
`first_at` and the first claimer). The id tie-break is **JS string order**: every comparison carries
`COLLATE "C"`. PGlite's default collation is C, Neon's databases may be linguistic (en_US): without
the explicit collation `a1…` would beat `B7…` on Neon and lose on the phone. The tests prove it for
the first-claimer tie-break by switching `turf_claims.activity_id` and
`turf_cells.first_activity_id` to ICU `und-x-icu` (fails without `COLLATE "C"`). The other orderings
(backlog by user id, unclaimed by activity id, cell pages by cell id) carry `COLLATE "C"` too but
are not re-collated in the tests: a real linguistic database is part of the Neon check.

**Known gap, phone vs server.** For the same operations the phone and the server agree on the
summary and on every cell (counts, first time) — G2, `turf-parity.json` in core, asserted by core,
the phone and the API. They do **not** agree on a claim's "new" cells (`isNew`, `newCellCount`,
`newAreaKm2`): the phone fixes them at arrival and never revises them (a late `hk-…` walk that is
older than everything: phone 0 new, D4 5; a same-instant tie: the phone credits the first arrival).
A mobile test pins this as a known gap. **The web must take "new turf" from the server
(`/v1/turf/claims/…`), never assume it equals the phone's card.**

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
  activities uploaded before this release is an explicit, resumable script (run by the founder) plus
  the bounded catch-up in the daily cron.
- **No events on the server.** `afterCommit` is a no-op and the Claim's `TurfClaimed` events are
  dropped: the server has no outbox and nothing subscribes.

Rejected: a new `TurfStore` port (core's `TerritoryRepository` already fits); `first_at` kept from a
deleted claim (the phone's old drift); storing strength or decay; lazy backfill on read; catching
every turf error.

## Reads (phase 2, contract 0.6.0)

Routes in `apps/api/src/routes/territory.ts`, behind `requireCaller` (bearer or the website's
cookie; reads need no CSRF headers), over `TurfService` (`apps/api/src/territory/turf-service.ts`):
core's `ListTurfCells`, `GetTurfSummary` and `GetClaimForActivity` from `createTurfApi`, at the
server's clock. Nothing is computed in the API but paging and tags.

- **`GET /v1/turf/cells?cursor=&limit=`** — the web downloads **every** cell once and draws it
  locally (the web portal plan: no viewport queries). Rows `[h3Id, walk, run, cycle]` by id (JS
  order), pages of **50,000** by default and at most (~1.5 MB; a test keeps 50k under Vercel's 4.5
  MB), answer `{ turfVersion, total, cells, nextCursor }`. Visits, strength and tier derive from the
  counts with core on the reader's side. A page is one `ORDER BY cell COLLATE "C" LIMIT/OFFSET`
  query plus a count (`TerritoryRepository.cellCounts`): it costs its rows, never the whole
  projection. Most users get their whole turf in one page, which no upload can invalidate halfway.
- **Cursor** = base64url `{ v, c, o }`: turf version, an opaque **account epoch** (12 characters of
  `sha256(userId:createdAt)`: changes when an erased account is re-created, reveals neither the id
  nor the creation time) and the offset. **Never a cell id** (cursors land in URLs, proxy logs,
  browser history; cell ids are location data). A cursor from another version, or another
  incarnation of the account (erased and re-created: versions restart at 0), answers
  **`410 turf.changed`** — a new code rather than `sync.cursor-expired`, whose remedy ("sync again
  without a cursor") belongs to the changes feed. Malformed → 400.
- **ETag** `"t<turfVersion>-<epoch>"`, `Cache-Control: private, no-store` (see "Caching" below). The
  version and epoch are read **first**: on the **first page**, `If-None-Match` naming them answers
  `304` without loading a row. Later pages share the tag but not the body, so they never answer 304
  (a client re-sending the tag on page 2 would otherwise get no cells). Reads take no lock: the tag
  is read again after the page, and a page whose version moved is re-read (first page) or refused
  with `410` (later pages), so a page never mixes two versions (tested by committing a write during
  the read). A first page the turf changes under on every try (3, a phone backup uploading) answers
  **`503 turf.busy`** with `Retry-After: 5`; clients pause briefly before restarting after a `410`.
- **`GET /v1/turf/summary`** — `private, no-store` (new this week/month depend on now).
- **`GET /v1/turf/claims/{activityId}`** — 404 `not-found` / 410 `activity.deleted` as every
  activity route; 404 also when the activity has no claim (a deferred start, not backfilled); cells
  `{ id, isNew }` sorted by id, "new" canonical (D4); `private, no-store`.
- **`GET /v1/activity-totals`** — `{ allTime, byType }` of `{ count, distanceM, movingS }`, gap
  estimates included, as the phone's `activityStats` (its `ActivityListItem.distanceM` is
  `distance_m + estimated_m`, checked in `sqlite-activity-repository.ts`). The store sums recorded
  and estimated apart; the use case adds them. **`GET /v1/activities`** gained `startedAfter`
  (inclusive) and `startedBefore` (exclusive), cursor unchanged.

**Caching (review, 2026-10-23; founder default, reversible).** `/v1/turf/cells` answers
`private, no-store`, not `no-cache`: `no-cache` lets a browser keep the body on disk and only
revalidate, so on a shared computer the next person's profile (or anyone reading the disk cache)
holds the previous user's whole turf — location data — after sign-out. The ETag stays: a client that
keeps the cells itself (the web map, in memory) still sends `If-None-Match` and gets `304`. The same
risk applies to **tracks** (`GET /v1/activities/{id}/track`: raw coordinates, worse than cells) and
the **activity detail** (bbox and preview line), which had kept `private, no-cache` since the
web-sessions change (W8): they are `private, no-store` with their ETags now too. No client relied on
the browser cache: the website fetches with `cache: 'no-store'`, the phone keeps its own copy.
Rejected: `no-cache` + `Clear-Site-Data` on sign-out (does not cover a closed tab or a crash, and
the cookie clear already relies on it); `max-age=0, must-revalidate` (still stored).

Rejected: a cell-id keyset cursor (location data in URLs); `sync.cursor-expired` for turf; one
response with every cell (50k+ users would pass 4.5 MB); a viewport (bbox) route (coordinates in
URLs, and the web map wants everything anyway); an ETag on the summary (cheap, and time-dependent).

## Backfill (phase 2)

`backfillTurf` (`apps/api/src/territory/backfill.ts`), used by
`pnpm --filter @cityturfer/api run turf:backfill -- [--user <id>] [--dry-run]` and by the daily
retention cron. It lists users with unclaimed activities (anti-join, user ids in `COLLATE "C"`
order), then per user calls `BackupService.catchUpTurf(userId, 1)` until nothing is left: one
activity per locked transaction (one track in memory, no long lock), oldest first by
`(started_at, id)`. Idempotent (a claimed activity is no longer unclaimed), resumable (stop any
time), safe next to uploads (the user lock serialises them; an activity an upload claimed meanwhile
just drops out). The tests cannot prove the lock itself: PGlite runs every transaction on one
session behind a mutex, so concurrent transactions there never contend; concurrent upload + backfill
is part of the Neon check. A user stops at the first deferred start (later starts are later still).
A failed claim is counted (error class reported) and passed over for the rest of the run, by
position, so one activity that keeps failing never holds back the user's newer ones; the next run
tries it first again. Output: counts only.

**Activities without a track (review, 2026-10-23).** The core's claim returns without saving when
the track has no point, so an activity row without an `activity_tracks` row (or with an empty one)
was counted as claimed and stayed unclaimed: the script looped on it for ever and the cron spent its
attempts on it every day. Now: `unclaimed()` and the backlog only count activities **with** a track;
those without are reported as `skipped` (once per run, never attempted) by the script, the cron and
`user:find`; `claimMissing` counts a claim only when the claim row exists afterwards (anything else
is `skipped`); a user gets at most as many attempts as they had pending; the script has a default
budget (20,000 activities) and deadline (30 min). Across runs they stay out by the query itself
(derived, no marker column): an upload that brings a track claims at once. Rejected: a
`turf_skipped` marker table (a migration for a state the query already knows, and one more table for
export and erasure); deleting trackless activities (the phone owns the data: support decides).

**Background jobs never re-create an account.** `lock()` inserts a missing `users` row (a
device-token user erased on another instance, so the request can still write). The catch-up, the
backfill and `turf:rebuild` use `lockExisting()` instead (`SELECT … FOR UPDATE` only) and skip a
user whose row is gone: an erasure between their listing and their transaction never brings back an
empty account.

The cron runs it with at most 25 attempts and ~60 s (`TURF_CATCH_UP_ACTIVITIES`, `TURF_CATCH_UP_MS`
in `apps/api/src/routes/internal.ts`) after the purge; a failure never fails the purge. Known limit:
users whose only unclaimed activities are deferred still take an attempt each per run, so in
theory > 25 of them could starve later users for a day (activities without a track no longer can).
Rollout order and the founder's production run: `docs/operations/api-deploy.md` ("Server turf").

## Rebuild after a rollback

0.5.0 does not maintain the projection. While it runs:

- deletes and withdrawals cascade claims away with their activities but leave their Turf Cells, so
  cells derived from erased or withdrawn data would survive a redeploy of 0.6.0 (B5);
- replaces update the activity and its track **in place** (an `UPDATE`, no cascade), so the claim
  keeps the old track's cells, type and start: turf the user trimmed away would stay for good, and a
  rebuild from the claims would faithfully restore it (review, 2026-10-23).

Each claim therefore records the activity's `track_hash` (migration 0006); a claim whose hash, type
or start no longer matches its activity is stale (`staleClaims`) and the rebuild re-claims it from
the stored track. `rebuildTurf` (`apps/api/src/territory/rebuild.ts`,
`pnpm --filter @cityturfer/api run turf:rebuild -- [--user <id>] [--dry-run]`) walks every user with
claims or cells, and per user, under `lockExisting()`, compares `turf_cells` with a recomputation
from `turf_claims` (`drift`: rows that differ either way) and calls `rebuildAll` only when they
differ — a user with cells and no claims loses them all — then re-claims the stale claims; a
consistent user is left alone (no turf version bump, no needless 304 → 200 for the web). Counts
only. The runbook makes it mandatory **immediately** after redeploying 0.6.0 after any rollback,
before `turf:backfill` and before the web turf pages are back on. 0006 is a new migration rather
than an edit of 0005, so it is right whether or not 0005 was already applied; claims from before it
carry `''` and are re-claimed once by the first rebuild. Rejected: rebuilding every user
unconditionally (bumps every ETag); a trigger on `activities` delete (0.5.0 code would not know
about it either way, and triggers are invisible to the core's rules).

## Export

Turf is **not** in the data export (`data.json`) for v0.10.0 (founder default): it is derived from
the activities, which are exported, and is rebuilt from them. Erasure covers both tables
(`apps/api/src/__tests__/erase.test.ts`).

## Measured (PGlite, local, 2026-10-23)

A 40k-point upload on a user with ~49k cells: claim 163 ms, release 46 ms, whole upload 236 ms;
reading all cells 262 ms. Not measured on Neon or Vercel.
