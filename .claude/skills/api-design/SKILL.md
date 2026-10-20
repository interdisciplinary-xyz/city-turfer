---
name: api-design
description:
  CityTurfer's HTTP API (apps/api, Hono on Vercel) — route conventions for /v1, contract-first
  schemas with @hono/zod-openapi and zod 4, the generated OpenAPI 3.1 spec (apps/api/openapi.json,
  drift check, Redocly lint), Swagger UI at cityturfer.local/swagger, errors as problem+json, auth,
  idempotent uploads of activities, privacy of location data, Vercel limits, and how routes map to
  the app's DDD use cases. Use before adding or changing any API route or schema, when planning sync
  between the phone and the server, when touching apps/api, the swagger dev route, or when someone
  asks "what does the API look like?" or "is this endpoint documented?".
---

# API design (apps/api)

Decision and route table: `docs/decisions/api-2026-10-20.md`. Architecture rules: the
`ddd-architecture` skill. Privacy rules: `CLAUDE.md` hard rules.

## Shape

- `apps/api` (`@cityturfer/api`): Hono app in `apps/api/src/app.ts`, Vercel entry
  `apps/api/src/index.ts` (`export default app`), local server `apps/api/src/server.ts`
  (`@hono/node-server`, port 8787).
- Routes per bounded context in `apps/api/src/routes/<context>.ts`, schemas in
  `apps/api/src/schemas/<context>.ts`, shared pieces (problem, ids, pagination) in
  `apps/api/src/schemas/common.ts`.
- **Routes are driving adapters:** validate (zod) → call a use case → map the result to a DTO.
  Business rules live in the domain (later `@cityturfer/core`), never in a handler.
- The spec is **generated**: `pnpm --filter @cityturfer/api run openapi` writes
  `apps/api/openapi.json`. Never edit it by hand. `ci:quality` regenerates it (fails on drift) and
  runs `redocly lint`.

## Conventions

- **Paths:** `/v1/<plural-noun>[/{id}[/<sub-resource>]]`, kebab-case. The user's own singletons sit
  under `/v1/me/…` (`/v1/me/home-city`). No verbs in paths except `auth/sign-in`.
- **Methods:** `GET` read, `PUT` create-or-replace by a **client id** (idempotent upload), `PATCH`
  partial update, `DELETE` remove (idempotent: 204 even when already gone).
- **JSON:** camelCase. Units are SI with a suffix, like the domain: `distanceM`, `movingS`,
  `areaKm2` only where the domain already uses km². Timestamps are **ISO 8601 UTC strings**
  (`startedAt: "2026-10-19T07:12:00Z"`); an Activity also carries its IANA `timeZone`.
- **Coordinates:** GeoJSON order `[lon, lat]`; bounding boxes `[west, south, east, north]`, as in
  the app's `BoundingBox` and MapLibre.
- **Ids:** opaque strings minted by the phone (session UUID, `hk-…` for Apple Health imports). The
  server never re-mints an id.
- **Pagination:** `limit` + `before` cursor (activity `startedAt`), the shape of `ListActivities`.
  Responses: `{ items, nextBefore }`.
- **Errors:** `application/problem+json` (RFC 9457): `type`, `title`, `status`, `detail`, plus our
  `code` (the domain's `DomainError.code`, e.g. `home-city.unknown`). 400 invalid input, 401 no or
  bad token, 404 not found (also for another user's id), 409 conflict, 413 track too large, 422 a
  broken domain rule, 501 planned route.
- **Auth:** `bearerAuth` (HTTP bearer). Every route needs it except `GET /v1/health`,
  `GET /v1/cities`, `POST /v1/auth/sign-in`, `/openapi.json` and `/swagger`.
- **Planned routes** are declared with full schemas and answer `501` with a problem body
  (`code: "not-implemented"`), and carry `x-cityturfer-status: planned` in the spec, so Swagger
  shows the whole API before it is built.

## Data and privacy

- GPS tracks are personal data. The server may store full tracks (founder's decision, 2026-10-20),
  owned by the user: `GET /v1/me/export` and `DELETE /v1/me` must cover every table.
- **Never** log request bodies, coordinates, track points, cell ids or Home City; log route, status,
  duration and user id only. No coordinates in error `detail`.
- **OpenAPI examples** use public landmarks (Warsaw Old Town, 21.0122 / 52.2297) and made-up ids,
  never real user data.
- Health Sync data (HealthKit) never reaches the server except as the Activities it imported.

## Vercel

- Region `fra1` (`apps/api/vercel.json`), EU data in EU regions (Neon `aws-eu-central-1`).
- **Request bodies ≤ 4.5 MB.** A track upload is compact (arrays, not objects per point) and may be
  gzipped (`Content-Encoding: gzip`); longer tracks are rejected with 413 and chunked by the client.
- Hobby is non-commercial: Pro before launch. Functions run on Node (h3-js is plain JS).
- Don't add `builds` to `vercel.json` (it turns zero-config off).

## Adding a route

1. Find the use case it drives (or write it first, in the domain/application layers).
2. Schemas in `apps/api/src/schemas/<context>.ts` with `.openapi('Name')` and an example; route with
   `createRoute` in `apps/api/src/routes/<context>.ts`, tags = the bounded context.
3. Handler: parse, call the use case, map to the DTO. Domain errors → problem+json via the shared
   error handler.
4. Test with `app.request()` in `apps/api/src/__tests__/` (Vitest).
5. `pnpm --filter @cityturfer/api run openapi`, look at it on https://cityturfer.local/swagger,
   commit `openapi.json`.
6. Update the route table in `docs/decisions/api-2026-10-20.md` if the status changed.
