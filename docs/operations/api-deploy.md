---
status: canonical
verified: 2026-10-22
owner: founder
scope:
  [
    apps/api/vercel.json,
    apps/api/scripts,
    apps/api/drizzle,
    apps/api/src/wiring.ts,
    apps/api/src/routes/internal.ts,
    apps/api/src/db/support.ts,
  ]
summary:
  Deploy the CityTurfer API — Vercel project city-turfer-api (apps/api, fra1), production branch,
  env vars (Neon, Better Auth, Brevo, cron), migrations before the merge, the daily retention cron,
  adopting the admin data, device tokens, support requests (find, delete), checking health
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
- **Production branch: `main`.** The production domain `city-turfer-api.vercel.app` serves the
  latest deployment of `main`; the release flow (`docs/process/release-manager.md`) merges
  `release/vX.Y.Z` → `main`, so that merge is the production deploy. Every other branch (feature,
  `scope/…`, `release/…`) gets a Preview deployment. Vercel's default production branch is the
  repo's default branch (`main`); confirm it in Settings → Git → Production Branch, since
  `vercel.json` cannot set it.
- Check a build locally without an account: a `.vercel/project.json` with
  `settings: { framework: "hono", rootDirectory: "apps/api" }` at the repo root, then
  `npx vercel build` (output in `.vercel/output`, gitignored).

## Environment variables (Production and Preview)

| Name                    | Where                | Value                                                                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Production, Preview  | Neon **pooled** connection string (Frankfurt). Required in prod; on a preview, missing → data routes answer 503.                                                                                                                                                                                                    |
| `DATABASE_URL_UNPOOLED` | your shell           | Neon direct connection string; used only by `db:migrate` and `auth:adopt` (optional).                                                                                                                                                                                                                               |
| `BETTER_AUTH_SECRET`    | Production, Preview  | ≥ 32 random characters (`openssl rand -base64 48`), different per environment. Turns on sign-in; required in prod.                                                                                                                                                                                                  |
| `BREVO_API_KEY`         | Production (Preview) | Brevo transactional e-mail key (EU account). Required in prod; without it a preview sends no mail.                                                                                                                                                                                                                  |
| `MAIL_FROM`             | Production (Preview) | `CityTurfer <hello@your-domain>`, a sender verified in Brevo (SPF/DKIM on the domain). Required in prod.                                                                                                                                                                                                            |
| `API_PUBLIC_URL`        | Production, Preview  | Public `https://…` base URL of this API (export links in e-mails). Required in prod.                                                                                                                                                                                                                                |
| `AUTH_FIXED_CODE`       | Preview only         | Six digits (e.g. `000000`): the code for addresses `@e2e.cityturfer.test` only (Maestro); real addresses always get random codes. **Never in Production: the function won't boot.**                                                                                                                                 |
| `CRON_SECRET`           | Production           | ≥ 16 random characters (`openssl rand -hex 32`). Vercel Cron sends it as `Authorization: Bearer …` to the retention route. Required in prod; without it the route is a 404.                                                                                                                                         |
| `API_TOKENS`            | Production           | JSON object `{"<sha256 hex>": "<userId>"}` (or `{"userId", "email", "displayName"}`); device tokens, one more release.                                                                                                                                                                                              |
| `WEB_ORIGIN`            | Production, Preview  | The website's origin, `https://…` without a path (production: the site's domain; a preview: that web preview's URL). Browser sign-in and cookie writes must come from it. Unset on Vercel → browser sessions off (phones unaffected); malformed → boot fails. Off Vercel it defaults to `https://cityturfer.local`. |

`VERCEL_ENV=production` (set by Vercel) is what "production" means for the boot guard: a missing
`DATABASE_URL`, `CRON_SECRET`, `BETTER_AUTH_SECRET`, `BREVO_API_KEY`, `MAIL_FROM` or
`API_PUBLIC_URL`, or any `AUTH_FIXED_CODE`, fails the function at start instead of running
half-configured (`checkProductionEnv` in `apps/api/src/wiring.ts`; the error names the variables,
never their values).

**Revoking sessions.** A session is a row in `auth_sessions`; the bearer token the phone holds is
that row's token signed with `BETTER_AUTH_SECRET` (`<token>.<HMAC>`), and only the signed form is
accepted (`bearer({ requireSignature: true })`). A website session is the same kind of row with
`client = 'browser'`, delivered as the `__Secure-ct_session` cookie instead; users revoke their own
sessions in the portal (`DELETE /v1/auth/sessions…`). To sign one user out everywhere, delete their
rows (`DELETE FROM auth_sessions WHERE user_id = '<userId>'`); to sign everyone out, delete all
rows. Rotating `BETTER_AUTH_SECRET` also invalidates every token (their signatures no longer match),
and it resets the rate-limit windows and voids pending sign-in codes (they are encrypted with it);
after a suspected leak of the secret or the database, do both. Follow-up, not done: session tokens
are still stored in plain text, so a database dump together with the secret is enough to take over
sessions; storing a hash of the token needs Better Auth support or our own session lookup.

**Preview deployments MUST use their own Neon branch, never the production database** (a preview has
test settings such as `AUTH_FIXED_CODE`; data, sessions and exports must not mix). The local dev
server (`apps/api/src/server.ts`) adds the `dev-token` for user `admin` only when neither
`API_TOKENS` nor `DATABASE_URL` is set, so it never reaches a Neon database.

## Migrations

| Migration                  | Contract | What                                              |
| -------------------------- | -------- | ------------------------------------------------- |
| `0000_init`                | 0.3.0    | users, consents, activities, tracks, gap routes … |
| `0001_activity_renamed_at` | 0.4.0    | `activities.renamed_at` (rename, last write wins) |
| `0002_auth`                | 0.4.0    | Better Auth `auth_*` tables, `rate_limits`        |
| `0003_exports`             | 0.4.0    | `data_exports`, `stored_files` (export zips)      |
| `0004_browser_sessions`    | 0.5.0    | `auth_sessions.client`, `absolute_expires_at`     |

Migrations are SQL files in `apps/api/drizzle/`, generated from `apps/api/src/db/schema.ts` with
`pnpm --filter @cityturfer/api run db:generate` and committed. Apply them to the production database
**before merging the `release/vX.Y.Z` → `main` PR** that deploys the code needing them (that merge
is the production deploy, see above):

```bash
DATABASE_URL='<neon production url>' pnpm --filter @cityturfer/api run db:migrate
```

Order: migrate production → check `GET /v1/health` still answers `database: ok` on the current
deployment → merge → check again on the new one. The running (old) code keeps working on the new
schema because migrations are additive. Previews migrate their own Neon branch the same way before
they are tested.

Safe to re-run: applied migrations are recorded in `drizzle.__drizzle_migrations`; new ones run in
one transaction. Keep migrations additive (add, backfill, then remove in a later release) so the
running version keeps working while the next one rolls out. They are not run in the Vercel build:
every preview build would migrate the database it points at.

## Website sessions: checks on a preview (before production)

The web portal reaches the API through the website's rewrite `/api/v1/*` → this API's `/v1/*`
(`apps/web/vercel.json`); the browser holds an `HttpOnly` cookie on the website's host. Local runs
cannot prove the Vercel hops, so on a preview pair (web preview + API preview, own Neon branch,
`WEB_ORIGIN` = the web preview's URL, migration `0004` applied) check, in Chrome and Safari:

1. **Cookie:** sign in on `/en/account`; DevTools shows `__Secure-ct_session` on the website's host,
   `Path=/api/v1`, `HttpOnly`, `Secure`, `SameSite=Strict`, no `Domain`; page requests outside
   `/api/v1` don't carry it; sign-out removes it.
2. **CSRF headers pass through:** writes (sign-out, consents) answer 204/200, not `403 auth.csrf`
   (the rewrite must keep `Origin` and `Sec-Fetch-Site`).
3. **Client IP:** the API's per-IP sign-in limits need the visitor's IP. Temporarily compare what
   the API sees (`x-vercel-forwarded-for`, `x-real-ip`, `x-forwarded-for`, read by `clientIp` in
   `apps/api/src/routes/identity.ts` in that order) with your public IP — through a throwaway
   preview-only log line or a debugger, never committed and never in production logs. If it is a
   Vercel address, all web users share one bucket (20 failed sign-ins / 30 codes per 10 minutes):
   record it and decide on a trusted-hop header or Vercel Firewall rules before launch.
4. **No edge caching:** personal answers carry `Cache-Control: private, no-store` and
   `x-vercel-cache` is absent or `MISS`.
5. **Sign out everywhere** (`scope=all`) signs the phone out; the phone shows its sign-in screen and
   keeps its data (device check).

## Accounts: adopting the existing `admin` data

The founder's history lives under user `admin` (today's device-token user). Before signing in on the
phone with a code, give that user the e-mail, so the account **is** `admin` (no data copied):

```bash
DATABASE_URL='<neon url>' pnpm --filter @cityturfer/api run auth:adopt -- admin <your e-mail>
```

It refuses when the e-mail already belongs to another account (delete that one first with
`DELETE /v1/me`). Without `DATABASE_URL` it works on the local PGlite (stop the dev server first).
The device token keeps working for the same user until it is removed from `API_TOKENS`.

## Retention cron

`apps/api/vercel.json` schedules `GET /internal/cron/retention` daily at 03:00 UTC (Hobby runs daily
crons once within that hour; crons run on production deployments only). It deletes export zips past
their 24 h expiry (they hold GPS tracks; before this they were deleted only when the next export was
requested), expired sign-in codes and sessions, and stale rate-limit counters, and logs the counts
(`retention.purged`). The route is internal: outside `/v1` and the OpenAPI spec, 401 without
`Authorization: Bearer $CRON_SECRET` (constant-time compare), 404 when `CRON_SECRET` is not set. Run
it by hand (Vercel → Settings → Cron Jobs → Run, or
`curl -H "Authorization: Bearer $CRON_SECRET" https://city-turfer-api.vercel.app/internal/cron/retention`);
it is idempotent and answers the counts.

## Device tokens

```bash
pnpm --filter @cityturfer/api run token:new -- admin
```

Prints the token once (put it on the phone; never commit or paste it anywhere else) and the
`API_TOKENS` entry. Add the entry to the JSON in Vercel and redeploy.

**Rotation:** mint a new token, add its hash next to the old one, redeploy, update the phone, then
remove the old hash and redeploy. **Revocation:** remove the hash and redeploy. The server stores
only hashes and never logs tokens.

## Support requests

There is no admin panel; support runs two scripts from a trusted machine against the production
database (`DATABASE_URL_UNPOOLED` or `DATABASE_URL` in your shell; without one they use the local
PGlite — stop the dev server first). They print ids, e-mails, counts, times and consents only: never
coordinates, tracks, activity names or the Home City. Don't paste their output into tickets or chats
beyond what the request needs.

```bash
pnpm --filter @cityturfer/api run user:find -- <userId|email>
pnpm --filter @cityturfer/api run user:delete -- <userId>         # dry run: shows what goes
pnpm --filter @cityturfer/api run user:delete -- <userId> --yes   # erases
```

`user:find` prints id, `email`, `signInEmail`, `createdAt`, activity and tombstone counts,
`lastActivityAt` (latest activity end), `lastUploadAt`, sessions, exports and consents.
`user:delete` takes the **id** (not an e-mail) and runs the same EraseAccount use case as
`DELETE /v1/me`: every row of the account in one transaction (auth rows and pending codes, consents,
activities, tracks, gap routes, tombstones, Home City, exports and their zips).

**Data deletion request by e-mail** (GDPR art. 17; answer within one month):

1. **Verify the sender owns the address first.** The request must come from the account's e-mail; if
   in doubt (forwarded, spoofable headers, a third party), reply to the account's address and act
   only on the answer from it. Never delete on a request from another address.
2. `user:find -- <their e-mail>`: note the id. No account → tell them the server holds nothing (the
   phone keeps its own data; deleting the app removes it).
3. `user:delete -- <id>` (dry run), check it is the same account, then `user:delete -- <id> --yes`.
4. If the account has a device token, remove its hash from `API_TOKENS` and redeploy (otherwise the
   next request with it creates an empty account again).
5. Reply that the server copy is erased and that the phone keeps its own until the app is deleted.
   Keep only the date and the fact of the request, not the data.

An **access request** (art. 15/20) is the in-app export (`POST /v1/me/exports`, e-mailed link); if
they cannot use the app, verify the address the same way and run `user:find` for what is held.

## Check

**After the first deploy, verify the export download:** request an export for an account with a long
history and download the e-mailed link; confirm a zip over 4.5 MB arrives whole (it is streamed
without `Content-Length`; untested on Vercel). If Vercel cuts it, move `FileStorage` to Vercel Blob
(D11). Building an export uses Fluid compute's default duration (300 s).

- `GET /v1/health` → `{"status":"ok","version":"0.4.0","coreVersion":"0.9.0","database":"ok"}`
  (`not-configured` without `DATABASE_URL`, `unreachable` when Neon does not answer).
- `GET /v1/me` with `Authorization: Bearer <token>` → the user; 401 `auth.invalid` when the hash is
  not in `API_TOKENS`.
- Swagger at `/swagger` on the deployment ("Authorize" with the token).
- Logs: one JSON line per request (route pattern, status, ms, request id); never bodies, ids,
  coordinates or tokens. An unexpected error adds one `request.error` line: request id, method,
  route pattern, error class, a short code (e.g. Postgres `23505`) and its cause's, and the
  `file:line:col` of the first stack frame — never the error message (database messages quote the
  query's values). Find the request by its id, then the code location in the bundle.
