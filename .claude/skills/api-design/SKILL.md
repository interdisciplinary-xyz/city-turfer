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
  feed of upserts, tombstones and the Home City; without a cursor it is the full manifest.
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
  and for 400 an `errors[]` of JSON pointers — never input values.
- **Headers:** `X-Request-Id` on every answer; `CityTurfer-Client` (426 `client.too-old`);
  `Retry-After` + `RateLimit` on 429; `Location` on 201/202.
- **Auth:** `bearerAuth` (HTTP bearer). Every route needs it except `GET /v1/health`,
  `POST /v1/auth/sign-in` (mock, dev only), `/openapi.json` and `/swagger`. Today: **device tokens**
  (stopgap until Better Auth) — env `API_TOKENS` maps `sha256(token)` hex → user id, compared in
  constant time; unknown → 401 `auth.invalid`. The user row is created on first sight. The
  placeholder verifier (spec generation, planned-route tests) marks callers unverified, which live
  routes refuse.
- **Consent:** activity and Home City writes need `cloud-sync` granted (Apple Health activities also
  `apple-health-in-cloud-sync`), else 403 `consent.required`; `DELETE` never needs it.
- **Planned routes** are declared with full schemas, answer `501` (`code: "not-implemented"`), carry
  `x-cityturfer-status: planned` and a `[planned]` summary prefix, so Swagger shows the whole API
  before it is built.

## Data and privacy

- GPS tracks are personal data. The server may store full tracks (founder's decision, 2026-10-20),
  owned by the user, after an opt-in consent (`cloud-sync`; Apple Health imports need
  `apple-health-in-cloud-sync`): exports (`POST /v1/me/exports`) and erasure (`DELETE /v1/me`) must
  cover every table, tombstones and consents included.
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
  `API_TOKENS` the token `dev-token` is user `admin`.
- **Env (Vercel):** `DATABASE_URL` (Neon pooled), optional `DATABASE_URL_UNPOOLED` (migrations),
  `API_TOKENS`. Runbook: `docs/operations/api-deploy.md`.
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
