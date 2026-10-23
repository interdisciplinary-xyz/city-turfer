---
status: canonical
verified: 2026-10-23
owner: founder
scope: [apps/api/src/auth, apps/api/src/backup, apps/api/src/db, apps/api/scripts]
summary:
  Stopgap for the first live backup — secret device tokens (API_TOKENS holds only SHA-256 hashes)
  instead of Better Auth, one-way backup phone → server on Neon Postgres via Drizzle, canonical
  trackHash computed by the server (contract 0.3.0)
---

# Device tokens and the one-way backup (stopgap)

On 2026-10-20 the founder asked for the phone to back up to the API the same day. Better Auth (D7 in
`docs/decisions/api-sync-2026-10-20.md`) needs Sign in with Apple, its own tables and an app
release, so this record chooses a smaller first step. Operations: `docs/operations/api-deploy.md`.

> **Status (2026-10-23):** T1 is replaced by e-mailed codes and sessions
> ([`api-accounts-2026-10-22.md`](api-accounts-2026-10-22.md), contract 0.4.0). Device tokens still
> authenticate (checked first, A6), and the phone falls back to a pasted token when no account is
> signed in (Developer tools). T2–T6 and the hash still stand; most of "Deferred" is built (below).

## Decisions

| #   | Decision    | Chosen                                                                                                                                      | Rejected (for now)                                         |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| T1  | Auth        | secret device tokens: `ct_` + 32 random bytes (base64url); env `API_TOKENS` maps `sha256(token)` hex → user id; constant-time check         | Better Auth today; mock sign-in in prod                    |
| T2  | Scope       | one-way backup phone → server: upload, read back, delete, changes feed, Home City                                                           | pull to a second device; server turf                       |
| T3  | `trackHash` | computed by the server (canonical encoding below); optional in the upload, checked when sent (422)                                          | required client hash                                       |
| T4  | Storage     | Neon Postgres (Frankfurt) via Drizzle, `user_id` in every key, committed migrations; tests and dev on PGlite                                | Docker Postgres in tests                                   |
| T5  | Consent     | writes need `cloud-sync` (Apple Health activities also `apple-health-in-cloud-sync`) → else `403 consent.required`; `DELETE` never needs it | deletes behind consent                                     |
| T6  | Migrations  | run by hand before a deploy that needs them (`db:migrate`); not in the Vercel build                                                         | migrate on every build (previews would migrate production) |

**Why tokens are a stopgap.** A token is a long-lived bearer secret: whoever copies it acts as the
user until the hash is removed from `API_TOKENS`. There is no sign-in, expiry, revocation list or
per-device identity, and every rotation is a redeploy. Fine for the founder's own phone; not for
testers. Better Auth replaces it before anyone else syncs: the `AuthVerifier` port in
`apps/api/src/deps.ts` is the only thing that changes.

## Canonical track hash

`trackHash` = SHA-256 (lowercase hex) of the UTF-8 bytes of `JSON.stringify(points)`, where `points`
is the uploaded array of `[lon, lat, t, segment, altitudeM | null]` in upload order: no whitespace,
numbers in ECMAScript's shortest round-trip form (`21.0122`, `1760857920000`, `-0` → `0`). A
JavaScript client gets the same hash by hashing `JSON.stringify` of the array it sends; the server
re-serialises the parsed array (`apps/api/src/backup/hashing.ts`). It is also the track's `ETag`.

## What the server does

- `PUT /v1/activities/{id}`: the summary comes from `@cityturfer/core` (`Activity.record`,
  `rename`); replay = same content hash (fields + `trackHash`) → 200; otherwise `If-Match`
  (428/412); tombstone → 410. A new track drops the stored gap routes (segments are renumbered); the
  phone sends them again.
- Every write of a user runs in one transaction that row-locks the user and takes the next value of
  the user's change counter, which orders `GET /v1/sync/changes` (cursor = last seq, opaque).
- Tombstones keep `(user_id, activity_id, deleted_at, change_seq)` only.
- Home City: last write wins on `chosenAt`; an equal or older choice is ignored.
- Since #149 the upload also claims the activity's turf in the same transaction
  ([`api-server-turf-2026-10-23.md`](api-server-turf-2026-10-23.md)).

## Deferred

Turf summary, cells and claims on the server, rename (`PATCH`), exports, `DELETE /v1/me`, rate
limits (D9), pull to a second device, Better Auth.

Built since: rename, exports, `DELETE /v1/me`, Postgres rate limits and Better Auth (contract
0.4.0), a one-time restore to a new phone
(`apps/mobile/src/contexts/cloud-backup/application/restore.ts`), server turf (#149, contract
0.6.0). Still not built: the phone pulling changes continuously (F1 in
[`data-flow-2026-10-23.md`](data-flow-2026-10-23.md)) and Upstash rate limits (D9).
