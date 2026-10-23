---
name: api-design
description: >-
  The HTTP API in apps/api (Hono, zod-openapi, generated OpenAPI spec, Swagger): route conventions,
  sync, errors, auth, privacy, Vercel limits, database and tokens. Use before adding or changing a
  route or schema, planning sync, or asked "what does the API look like?".
---

# API design (apps/api)

Design and route table: `docs/decisions/api-sync-2026-10-20.md` (sync-first contract, decisions
D1–D13); stack and phases: `docs/decisions/api-2026-10-20.md`. Architecture rules: the
`ddd-architecture` skill. Privacy rules: `CLAUDE.md` hard rules. The generated
`apps/api/openapi.json` is the contract.

## Shape

- `apps/api` (`@cityturfer/api`): Hono app in `apps/api/src/app.ts`, Vercel entry
  `apps/api/src/index.ts` (`export default app`), local server `apps/api/src/server.ts`
  (`@hono/node-server`, port 8787), bundled for Vercel by `apps/api/scripts/build.ts`.
- `createApp(deps)` takes its dependencies (`ApiDeps` in `apps/api/src/deps.ts`: auth, clock, log,
  `store`); `apps/api/src/wiring.ts` builds them from env (Neon + `API_TOKENS`), tests inject PGlite
  (`apps/api/src/__tests__/support.ts`). Middleware: request id, then per route auth (**before**
  validation: no token → 401, never 400), on live routes the database + user (`requireStore`: 503
  `storage.unavailable` without a database), then zod validation.
- **Backup (live since contract 0.3.0):** application layer `apps/api/src/backup/` (`BackupService`
  use cases, `BackupStore` port, canonical `trackHash` in `hashing.ts`, summary via
  `@cityturfer/core` in `summary.ts`); adapter `apps/api/src/db/` (Drizzle schema, store, Neon and
  PGlite clients); migrations in `apps/api/drizzle/` (committed). Decision:
  `docs/decisions/api-device-tokens-2026-10-20.md`.
- **Server turf (contract 0.6.0):** `apps/api/src/territory/` — `TurfProjection` (core's
  `createTurfApi` over `DrizzleTerritoryRepository`, tables `turf_claims` / `turf_cells`,
  `users.turf_version`, migration `0005_turf`), `TurfService` (reads), `backfill.ts`, `rebuild.ts`.
  The projection is written in the **same locked transaction** as upload, replace, delete and
  consent withdrawal (a replay changes nothing; only `claim.in-future` is swallowed: stored
  unclaimed, caught up later). Canonical first claimer per cell (D4) with `COLLATE "C"` on every id
  comparison; no decay stored. Rules: the `turf-territory` skill; decision
  `docs/decisions/api-server-turf-2026-10-23.md`.
- Routes per bounded context in `apps/api/src/routes/<context>.ts` (identity, privacy, sync,
  activities, territory, and `platform` for `GET /v1/health`), records → JSON mappers in
  `apps/api/src/routes/dto.ts`, declared through `defineRoute()` (`routes/define.ts`) with
  `status: 'planned' | 'live'`; schemas in `apps/api/src/schemas/<context>.ts`; shared pieces
  (problem, ids, cursor, headers, standard responses) in `apps/api/src/schemas/common.ts`; the error
  code catalogue in `apps/api/src/errors.ts`.
- **Routes are driving adapters:** validate (zod) → call a use case → map the result to a DTO.
  Business rules live in the domain (`@cityturfer/core`, `packages/core`), never in a handler.
- The spec is **generated**: `pnpm --filter @cityturfer/api run openapi` writes
  `apps/api/openapi.json`. Never edit it by hand. A Vitest case in
  `apps/api/src/__tests__/app.test.ts` builds the spec from the routes and fails when it differs
  from the committed file (so `ci:quality` catches drift, it does not regenerate); the `lint` script
  runs `redocly lint` on it.

## Conventions

- **Tenant = the token.** `/v1/activities`, `/v1/turf/…` and `/v1/sync/…` are the caller's own.
  `/v1/me/…` is only for the account itself (profile, consents, exports, erasure). Paths are owned
  by the bounded context of the aggregate: the Claim and the Home City sit under `/v1/turf/`.
- **Paths:** `/v1/<plural-noun>[/{id}[/<sub-resource>]]`, kebab-case. No verbs except
  `auth/sign-in`.
- **Methods:** `GET` read, `PUT` create-or-replace by a **client id** (idempotent upload), `PATCH`
  partial update, `DELETE` remove (idempotent: 204 even when already gone), `POST` only to start a
  job (`/v1/me/exports`, 202) or to sign in. No `Idempotency-Key`: writes are idempotent by id.
- **Sync:** Activities carry `version`, `trackHash` and an `ETag` (`"v<version>"`). Replacing an
  existing Activity with different content needs `If-Match` (412 stale, 428 missing); a deleted id
  answers **410 `activity.deleted`** (tombstones, delete wins). `GET /v1/sync/changes` is the one
  feed of upserts, tombstones and the Home City; without a cursor it is the full manifest. Feed
  entries carry no geometry (no `preview`) and a page stops at `limit` or ~1 MB (`MAX_PAGE_BYTES`);
  restore = manifest, then detail + track per activity (test:
  `apps/api/src/__tests__/restore.test.ts`). `source` is derived from the id (`hk-…` ⇒
  `apple-health`, 422 `activity.source-mismatch`). `PUT …/gap-routes` with an empty list sets
  `gapsCheckedAt` ("checked, no gaps"). Rename = `PATCH` `{ name, renamedAt }`, last write wins on
  `renamedAt` (like the Home City on `chosenAt`); more than 5 min ahead of the server → 422.
  `GET /v1/activities` filters by `startedAfter` (inclusive) / `startedBefore` (exclusive);
  `GET /v1/activity-totals` sums recorded + gap-estimated distance like the phone's stats.
- **Turf reads:** `GET /v1/turf/cells` pages every cell (`[h3Id, walk, run, cycle]`, 20,000 per
  page, ≤ 50,000; the web draws locally, no bbox route), `GET /v1/turf/summary` (`no-store`, depends
  on now), `GET /v1/turf/claims/{activityId}` (canonical "new" cells; 404 without a claim). The
  cells **cursor never holds a cell id** (location data in URLs and logs): it is base64url
  `{ v, c, o }` = turf version, account `createdAt` (base 36), offset. A cursor from another version
  or account incarnation → **410 `turf.changed`** (start again; not `sync.cursor-expired`, which
  belongs to the changes feed). ETag `"t<turfVersion>-<createdAt base 36>"` read first, so
  `If-None-Match` → 304 without loading rows; `private, no-store` (location data never in a browser
  cache: shared computers; the ETag serves clients that keep the cells in memory).
- **JSON:** camelCase. Units are SI with a suffix, like the domain: `distanceM`, `movingS`,
  `areaKm2` only where the domain already uses km². Timestamps are **ISO 8601 UTC strings**
  (`startedAt: "2026-10-19T07:12:00Z"`, `z.iso.datetime()`); an Activity may carry its IANA
  `timeZone`. The server never derives local-time things (names, weeks, achievements).
- **Coordinates:** GeoJSON order `[lon, lat]`; bounding boxes `[west, south, east, north]`, as in
  the app's `BoundingBox` and MapLibre. Track points are `[lon, lat, t, segment, altitudeM|null]`
  (no accuracy or speed, D1).
- **Ids:** opaque strings minted by the phone (session UUID, `hk-…` for Apple Health imports). The
  server never re-mints an id. `demo-*` activities are never uploaded.
- **Pagination:** `limit` + opaque `cursor`; responses `{ items, nextCursor }` (feed:
  `{ changes, nextCursor, hasMore }`).
- **Errors:** `application/problem+json` (RFC 9457): `type`, `title`, `status`, `detail`, our `code`
  from the catalogue in `apps/api/src/errors.ts` (domain codes like `home-city.unknown` included),
  and for 400 an `errors[]` of JSON pointers (at most 20) — never input values.
- **Headers:** `X-Request-Id` on every answer; `Cache-Control: private, no-store` and
  `Vary: Cookie, Authorization` by default on `/v1` (`personalCaching`; no route relaxes it: tracks,
  activity detail and turf cells set `no-store` too and keep an ETag); `CityTurfer-Client` (426
  `client.too-old`); `Retry-After` + `RateLimit` on 429; `Location` on 201/202.
- **Auth:** `bearerAuth` (HTTP bearer) or `cookieAuth` (the website's `__Host-ct_session`,
  `requireCaller` in `apps/api/src/middleware.ts`; cookie writes need `Origin` = `WEB_ORIGIN` and
  `CityTurfer-Client: web/<version>`, else 403 `auth.csrf`; principals carry `realm: 'user'`; design
  `docs/decisions/api-web-sessions-2026-10-22.md`). Every route needs one except `GET /v1/health`,
  `POST /v1/auth/codes`, `POST /v1/auth/sign-in`, `GET /v1/exports/{key}` (the key is the
  credential), `/openapi.json` and `/swagger`. **Sign-in** = e-mailed 6-digit code via Better Auth
  (`apps/api/src/identity/`: `better-auth.ts`, `use-cases.ts` IdentityService, `mailer.ts` Mailer
  port with Brevo/Console/Memory/Null adapters); we call `auth.api.*` from our own routes, never
  mount `auth.handler`. Our own rate limits in Postgres (`rate_limits`,
  `apps/api/src/db/rate-limits.ts`; the numbers in `AUTH_LIMITS`,
  `apps/api/src/identity/rate-limit.ts`: per address with daily caps, per IP bucket (IPv6 /64) loose
  and counting only failed sign-ins). Tables `auth_*`; the Better Auth user id is `users.id`. The
  verifier is composite: **device tokens** (`API_TOKENS`, sha256 → user id, constant time; one more
  release) first, then sessions (only the signed token `<token>.<HMAC>` is accepted:
  `bearer({ requireSignature: true })`; phone sessions only as bearer, browser sessions only from
  the cookie; IdentityService slides them: phones 60 days, browsers 14 under a 30-day or 8-hour cap;
  users list and revoke them via `/v1/auth/sessions`); unknown → 401 `auth.invalid`. The user row is
  created on first sight. The placeholder verifier (spec generation, planned-route tests) marks
  callers unverified, which live routes refuse. Decision:
  `docs/decisions/api-accounts-2026-10-22.md`.
- **Account settings (0.5.0):** `PATCH /v1/me` (name), step-up codes, e-mail change, optional
  password (`AccountService` in `apps/api/src/identity/account.ts`, repository
  `apps/api/src/db/accounts.ts`, codes in `codes.ts`, `BreachedPasswords` port in
  `breached-passwords.ts`: HIBP on Vercel, a fake in tests and the dev server). Field rules come
  from `@cityturfer/core/identity` (their codes are problem codes). Only session callers
  (`accountCaller`; device tokens → 403 `identity.account-required`); the step-up check is in each
  use case, never a middleware; step-up codes and wrong account codes are rate-limited per user id,
  never in the address's sign-in buckets (a stranger can fill those). E-mail and password changes,
  and removing the password, revoke every other session (phones and browsers) in the same
  transaction, keeping the caller's by session id (`revokeSessionsOf` in `db/sessions.ts`, shared
  with the `SessionStore`), and a sign-in that raced one is re-checked and dropped. Cookie callers
  pass the CSRF guard like any write. Password sign-in is the second body of `POST /v1/auth/sign-in`
  (`auth.api.signInEmail`; every failure `401 auth.invalid-credentials`), with `client: "browser"`
  and `sharedComputer` as for codes. Decision: `docs/decisions/account-settings-2026-10-22.md`.
- **Consent:** activity and Home City writes need `cloud-sync` granted (Apple Health activities also
  `apple-health-in-cloud-sync`), else 403 `consent.required`; `DELETE` never needs it. Withdrawing
  erases the server copy it covered (`eraseBackup`, no new tombstones): `cloud-sync` → everything
  but the account, consents and existing tombstones (kept so delete wins, D5; they go with the
  account), `apple-health-in-cloud-sync` → the `hk-…` activities. Use cases read consent **after**
  `tx.lock()` (transactions are READ COMMITTED), so a write cannot land after a withdrawal's erase.
- **Planned routes** (none since 0.6.0) are declared with full schemas, answer `501`
  (`code: "not-implemented"`), carry `x-cityturfer-status: planned` and a `[planned]` summary
  prefix, so Swagger shows the whole API before it is built.

## Data and privacy

- GPS tracks are personal data. The server may store full tracks (founder's decision, 2026-10-20),
  owned by the user, after an opt-in consent (`cloud-sync`; Apple Health imports need
  `apple-health-in-cloud-sync`): exports (`POST /v1/me/exports`) and erasure (`DELETE /v1/me`, 204,
  one transaction: `eraseAccount` in `apps/api/src/db/store.ts`) must cover every table, tombstones,
  consents and the `auth_*` rows included. A new table hangs off `users` with `ON DELETE CASCADE`
  (or is deleted in `eraseAccount`) — `apps/api/src/__tests__/erase.test.ts` counts the rows.
- **Export** (`apps/api/src/privacy/`): `POST /v1/me/exports` reserves a `pending` row under the
  user lock (one per 24 h), streams the zip into fflate (`data.json` + GPX 1.1 per activity, ≤ 50
  MB), stores it behind the `FileStorage` port (Postgres `bytea`, `apps/api/src/db/exports.ts`;
  Vercel Blob later) and e-mails a link `GET /v1/exports/{key}` (public; only the key's SHA-256 is
  stored; repeatable until it expires after 24 h; streamed). Failures leave `failed` and no file.
  Consent withdrawal deletes export files too.
- **Never** log request bodies, coordinates, track points, cell ids or Home City; log route, status,
  duration and user id only. No coordinates in error `detail`.
- **OpenAPI examples** use public landmarks (Warsaw Old Town, 21.0122 / 52.2297) and made-up ids,
  never real user data.
- Health Sync data (HealthKit) never reaches the server except as the Activities it imported.

## Vercel

- Region `fra1` (`apps/api/vercel.json`), EU data in EU regions (Neon `aws-eu-central-1`).
- **Request and response bodies ≤ 4.5 MB.** A track upload is compact (arrays, not objects per
  point, ≤ 40,000 points) and may be gzipped (`Content-Encoding: gzip`, inflated with a size cap);
  bigger ones get 413. Anything that can outgrow 4.5 MB (the data export) is an async job with a
  download link.
- Hobby is non-commercial: Pro before launch. Functions run on Node (h3-js is plain JS).
- Don't add `builds` to `vercel.json` (it turns zero-config off).

## Running it (env, migrations, tokens)

- **Local:** `pnpm --filter @cityturfer/api dev` (port 8787; `PORT=8788 …` for another). Without
  `DATABASE_URL` it uses PGlite in `apps/api/.data/` (gitignored, migrated on start); without
  `API_TOKENS` and `DATABASE_URL` the token `dev-token` is user `admin` (never against Neon).
- **Env (Vercel):** `DATABASE_URL` (Neon pooled), optional `DATABASE_URL_UNPOOLED` (migrations),
  `BETTER_AUTH_SECRET`, `BREVO_API_KEY`, `MAIL_FROM`, `API_PUBLIC_URL`, `CRON_SECRET`, `API_TOKENS`,
  `WEB_ORIGIN` (the website, for browser sessions; unset on Vercel → off); `AUTH_FIXED_CODE` on
  previews only, and only for `@e2e.cityturfer.test` addresses (production refuses to boot with it,
  or without the others: `checkProductionEnv` in `apps/api/src/wiring.ts`). Production also needs
  `DATABASE_URL` and `CRON_SECRET` (daily Vercel Cron `GET /internal/cron/retention`, outside `/v1`
  and the spec, purges expired exports, codes, sessions and rate-limit rows). Unexpected errors log
  one sanitised `request.error` line (`describeError`, never the message). Runbook:
  `docs/operations/api-deploy.md`.
- **Server turf rollout** (`docs/operations/api-deploy.md`, "Server turf"): migrate `0005_turf`
  **before** the merge that deploys 0.6.0 (it reads `users.turf_version`: else `/v1/me`, uploads and
  turf 500), deploy, then the founder runs
  `turf:backfill -- [--user <id>] [--dry-run] [--max <n>] [--minutes <n>]` (one activity per locked
  transaction, idempotent, resumable, bounded, counts only; activities without a track are
  `skipped`, never attempted), and only then ship the web turf map. The daily retention cron also
  catches up ≤ 25 unclaimed activities (~60 s) after the purge. After any rollback to 0.5.0:
  `turf:rebuild -- [--user <id>] [--dry-run]` before the backfill (0.5.0 leaves cells of deleted
  activities). Background jobs lock with `lockExisting()` (never re-create an erased account).
- **Support (no admin panel):** `user:find -- <id|email>` (no coordinates; turf claim counts) and
  `user:delete -- <id> [--yes]` (same erase as `DELETE /v1/me`; dry run without `--yes`).
- **Codes locally:** the dev server prints them (ConsoleMailer); tests read them from MemoryMailer
  (`h.signIn(email)` in `apps/api/src/__tests__/support.ts`). `auth:adopt -- <userId> <email>` gives
  an existing data user an e-mail sign-in.
- **Schema change:** edit `apps/api/src/db/schema.ts` (`user_id` first in every key), then
  `pnpm --filter @cityturfer/api run db:generate`, commit `apps/api/drizzle/`. Apply with
  `DATABASE_URL=… pnpm --filter @cityturfer/api run db:migrate` before deploying (not in the build).
  Tests run the same migrations on PGlite.
- **Tokens:** `pnpm --filter @cityturfer/api run token:new -- <userId>` prints the token (device
  only) and the `API_TOKENS` entry. Rotate: add new hash, update device, remove old hash.
- **Build:** `pnpm --filter @cityturfer/api run build` bundles `apps/api/src/index.ts` +
  `@cityturfer/core` with esbuild into `dist/index.mjs`; `vercel.json` (`outputDirectory: dist`)
  makes the Hono builder use it. Vercel's own per-file transpile can't run extensionless ESM imports
  or the core's TS.

## Adding a route

1. Find the use case it drives (or write it first, in the domain/application layers).
2. Schemas in `apps/api/src/schemas/<context>.ts` with `.openapi('Name')` and an example (public
   landmarks only — a test checks coordinates); route with `defineRoute` in
   `apps/api/src/routes/<context>.ts`, tags = the bounded context.
3. Handler: parse, call the use case, map to the DTO. Domain errors → problem+json via the shared
   error handler.
4. Test with `app.request()` in `apps/api/src/__tests__/` (Vitest).
5. `pnpm --filter @cityturfer/api run openapi`, look at it on https://cityturfer.local/swagger,
   commit `openapi.json`.
6. Update the route table in `docs/decisions/api-sync-2026-10-20.md` (a test fails when an operation
   is missing from it).
