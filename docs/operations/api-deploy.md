---
status: canonical
verified: 2026-10-20
owner: founder
scope: [apps/api/vercel.json, apps/api/scripts, apps/api/drizzle, apps/api/src/wiring.ts]
summary:
  Deploy the CityTurfer API — Vercel project city-turfer-api (apps/api, fra1), Neon Postgres env
  vars, applying migrations, minting and rotating device tokens, checking health
---

# API deploy runbook

Design: `docs/decisions/api-sync-2026-10-20.md` and
`docs/decisions/api-device-tokens-2026-10-20.md`.

## Vercel project

- Project `city-turfer-api`, Git repo of the monorepo, **Root Directory `apps/api`**, framework
  Hono, region `fra1` (`apps/api/vercel.json`).
- `vercel.json` sets `buildCommand: pnpm run build` (esbuild bundles `apps/api/src/index.ts` and
  `@cityturfer/core` into `dist/index.mjs`) and `outputDirectory: dist`, where the Hono builder
  finds the entry. Install is the default (`pnpm install` of the workspace). Don't add `builds`.
- Check a build locally without an account: a `.vercel/project.json` with
  `settings: { framework: "hono", rootDirectory: "apps/api" }` at the repo root, then
  `npx vercel build` (output in `.vercel/output`, gitignored).

## Environment variables (Production and Preview)

| Name                    | Value                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon **pooled** connection string (Frankfurt). Missing → data routes answer 503.               |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string; used only by `db:migrate` (optional).                           |
| `API_TOKENS`            | JSON object `{"<sha256 hex>": "<userId>"}` (or `{"userId", "email", "displayName"}` as value). |

Preview deployments should get their own Neon branch, never the production database. The local dev
server (`apps/api/src/server.ts`) adds the `dev-token` for user `admin` only when neither
`API_TOKENS` nor `DATABASE_URL` is set, so it never reaches a Neon database.

## Migrations

| Migration                  | Contract | What                                              |
| -------------------------- | -------- | ------------------------------------------------- |
| `0000_init`                | 0.3.0    | users, consents, activities, tracks, gap routes … |
| `0001_activity_renamed_at` | 0.4.0    | `activities.renamed_at` (rename, last write wins) |

Migrations are SQL files in `apps/api/drizzle/`, generated from `apps/api/src/db/schema.ts` with
`pnpm --filter @cityturfer/api run db:generate` and committed. Apply them **before** deploying code
that needs them:

```bash
DATABASE_URL='<neon url>' pnpm --filter @cityturfer/api run db:migrate
```

Safe to re-run: applied migrations are recorded in `drizzle.__drizzle_migrations`; new ones run in
one transaction. Keep migrations additive (add, backfill, then remove in a later release) so the
running version keeps working while the next one rolls out. They are not run in the Vercel build:
every preview build would migrate the database it points at.

## Device tokens

```bash
pnpm --filter @cityturfer/api run token:new -- admin
```

Prints the token once (put it on the phone; never commit or paste it anywhere else) and the
`API_TOKENS` entry. Add the entry to the JSON in Vercel and redeploy.

**Rotation:** mint a new token, add its hash next to the old one, redeploy, update the phone, then
remove the old hash and redeploy. **Revocation:** remove the hash and redeploy. The server stores
only hashes and never logs tokens.

## Check

- `GET /v1/health` → `{"status":"ok","version":"0.4.0","coreVersion":"0.9.0","database":"ok"}`
  (`not-configured` without `DATABASE_URL`, `unreachable` when Neon does not answer).
- `GET /v1/me` with `Authorization: Bearer <token>` → the user; 401 `auth.invalid` when the hash is
  not in `API_TOKENS`.
- Swagger at `/swagger` on the deployment ("Authorize" with the token).
- Logs: one JSON line per request (route pattern, status, ms, request id); never bodies, ids,
  coordinates or tokens.
