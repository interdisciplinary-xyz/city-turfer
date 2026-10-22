---
status: canonical
verified: 2026-10-22
owner: founder
scope: [apps/api/vercel.json, apps/api/scripts, apps/api/drizzle, apps/api/src/wiring.ts]
summary:
  Deploy the CityTurfer API — Vercel project city-turfer-api (apps/api, fra1), env vars (Neon,
  Better Auth, Brevo), applying migrations, adopting the admin data, device tokens, checking health
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

| Name                    | Where                | Value                                                                                                                      |
| ----------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Production, Preview  | Neon **pooled** connection string (Frankfurt). Missing → data routes answer 503.                                           |
| `DATABASE_URL_UNPOOLED` | your shell           | Neon direct connection string; used only by `db:migrate` and `auth:adopt` (optional).                                      |
| `BETTER_AUTH_SECRET`    | Production, Preview  | ≥ 32 random characters (`openssl rand -base64 48`), different per environment. Turns on sign-in; required in prod.         |
| `BREVO_API_KEY`         | Production (Preview) | Brevo transactional e-mail key (EU account). Required in prod; without it a preview sends no mail.                         |
| `MAIL_FROM`             | Production (Preview) | `CityTurfer <hello@your-domain>`, a sender verified in Brevo (SPF/DKIM on the domain). Required in prod.                   |
| `API_PUBLIC_URL`        | Production, Preview  | Public `https://…` base URL of this API (export links in e-mails). Required in prod.                                       |
| `AUTH_FIXED_CODE`       | Preview only         | Six digits (e.g. `000000`): every sign-in code is this one, for Maestro. **Never in Production: the function won't boot.** |
| `API_TOKENS`            | Production           | JSON object `{"<sha256 hex>": "<userId>"}` (or `{"userId", "email", "displayName"}`); device tokens, one more release.     |

`VERCEL_ENV=production` (set by Vercel) is what "production" means for the boot guard: a missing
`BETTER_AUTH_SECRET`, `BREVO_API_KEY`, `MAIL_FROM` or `API_PUBLIC_URL`, or any `AUTH_FIXED_CODE`,
fails the function at start instead of running half-configured. Rotating `BETTER_AUTH_SECRET` signs
everyone out and resets the rate-limit windows.

Preview deployments should get their own Neon branch, never the production database. The local dev
server (`apps/api/src/server.ts`) adds the `dev-token` for user `admin` only when neither
`API_TOKENS` nor `DATABASE_URL` is set, so it never reaches a Neon database.

## Migrations

| Migration                  | Contract | What                                              |
| -------------------------- | -------- | ------------------------------------------------- |
| `0000_init`                | 0.3.0    | users, consents, activities, tracks, gap routes … |
| `0001_activity_renamed_at` | 0.4.0    | `activities.renamed_at` (rename, last write wins) |
| `0002_auth`                | 0.4.0    | Better Auth `auth_*` tables, `rate_limits`        |

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

## Accounts: adopting the existing `admin` data

The founder's history lives under user `admin` (today's device-token user). Before signing in on the
phone with a code, give that user the e-mail, so the account **is** `admin` (no data copied):

```bash
DATABASE_URL='<neon url>' pnpm --filter @cityturfer/api run auth:adopt -- admin <your e-mail>
```

It refuses when the e-mail already belongs to another account (delete that one first with
`DELETE /v1/me`). Without `DATABASE_URL` it works on the local PGlite (stop the dev server first).
The device token keeps working for the same user until it is removed from `API_TOKENS`.

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
