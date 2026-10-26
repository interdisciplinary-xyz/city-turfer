---
status: canonical
verified: 2026-10-23
owner: founder
scope:
  [
    apps/api/vercel.json,
    apps/api/scripts,
    apps/api/drizzle,
    apps/api/src/wiring.ts,
    apps/api/src/routes/internal.ts,
    apps/api/src/client-ip.ts,
    apps/api/src/db/support.ts,
    apps/api/src/territory/backfill.ts,
    apps/api/src/territory/rebuild.ts,
  ]
summary:
  Deploy the CityTurfer API — Vercel project city-turfer-api (apps/api, fra1), production branch,
  env vars (Neon, Better Auth, Brevo, cron), migrations before the merge, the server turf rollout
  (migrate 0005 and 0006 before the merge, deploy, turf:backfill, then the web map; turf:rebuild
  straight after redeploying from a rollback), the daily retention cron with its turf catch-up,
  adopting the admin data, device tokens, support requests (find, delete), checking health
---

# API deploy runbook

Design: `docs/decisions/api-sync-2026-10-20.md` and
`docs/decisions/api-device-tokens-2026-10-20.md`.

**Status (2026-10-26):** v0.11.0 ships API contract 0.6.1 (text only: the demo profile's Gdańsk
upload; `API_VERSION` in `apps/api/src/spec.ts`); v0.10.0 shipped 0.6.0. v0.12.0 changed only the
Swagger page's colours. On `scope/v0.13.0`, `GET /v1/turf/summary` counts "new this week" from
Monday 00:00 UTC instead of a rolling 7 days (no migration, no env var); `API_VERSION` is still
0.6.1. Whether production has had its steps (Neon `db:migrate` 0004–0006, `WEB_EDGE_SECRET` on both
Vercel projects, `WEB_ORIGIN`, the turf backfill) is not recorded anywhere in the repo: **pending
(founder)** until checked. `GET /v1/health` on production answers the deployed version.

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

| Name                    | Where                | Value                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Production, Preview  | Neon **pooled** connection string (Frankfurt). Required in prod; on a preview, missing → data routes answer 503.                                                                                                                                                                                                                                                                                     |
| `DATABASE_URL_UNPOOLED` | your shell           | Neon direct connection string; used only by `db:migrate` and `auth:adopt` (optional).                                                                                                                                                                                                                                                                                                                |
| `BETTER_AUTH_SECRET`    | Production, Preview  | ≥ 32 random characters (`openssl rand -base64 48`), different per environment. Turns on sign-in; required in prod.                                                                                                                                                                                                                                                                                   |
| `BREVO_API_KEY`         | Production (Preview) | Brevo transactional e-mail key (EU account). Required in prod; without it a preview sends no mail.                                                                                                                                                                                                                                                                                                   |
| `MAIL_FROM`             | Production (Preview) | `CityTurfer <hello@your-domain>`, a sender verified in Brevo (SPF/DKIM on the domain). Required in prod.                                                                                                                                                                                                                                                                                             |
| `API_PUBLIC_URL`        | Production, Preview  | Public `https://…` base URL of this API (export links in e-mails). Required in prod.                                                                                                                                                                                                                                                                                                                 |
| `AUTH_FIXED_CODE`       | Preview only         | Six digits (e.g. `000000`): the code for addresses `@e2e.cityturfer.test` only (Maestro); real addresses always get random codes. **Never in Production: the function won't boot.**                                                                                                                                                                                                                  |
| `CRON_SECRET`           | Production           | ≥ 16 random characters (`openssl rand -hex 32`). Vercel Cron sends it as `Authorization: Bearer …` to the retention route. Required in prod; without it the route is a 404.                                                                                                                                                                                                                          |
| `API_TOKENS`            | Production           | JSON object `{"<sha256 hex>": "<userId>"}` (or `{"userId", "email", "displayName"}`); device tokens, one more release.                                                                                                                                                                                                                                                                               |
| `WEB_ORIGIN`            | Production, Preview  | The website's origin, `https://…` without a path (production: the site's domain; a preview pair: the web preview's **branch URL**, see below). Browser sign-in and cookie writes must come from it. Unset on Vercel, or set without a valid `WEB_EDGE_SECRET` on a preview → browser sessions off (phones unaffected); malformed → boot fails. Off Vercel it defaults to `https://cityturfer.local`. |
| `WEB_EDGE_SECRET`       | Production, Preview  | ≥ 32 random characters (`openssl rand -hex 32`), **the same value on the website's Vercel project**, different per environment. The website's `/api/v1/*` route sends it as `cityturfer-edge`; only then does the API trust `x-vercel-forwarded-for` for the per-IP sign-in limits (`apps/api/src/client-ip.ts`). Required in prod when `WEB_ORIGIN` is set.                                         |

`VERCEL_ENV=production` (set by Vercel) is what "production" means for the boot guard: a missing
`DATABASE_URL`, `CRON_SECRET`, `BETTER_AUTH_SECRET`, `BREVO_API_KEY`, `MAIL_FROM` or
`API_PUBLIC_URL`, a `WEB_ORIGIN` without `WEB_EDGE_SECRET`, or any `AUTH_FIXED_CODE`, fails the
function at start instead of running half-configured (`checkProductionEnv` in
`apps/api/src/wiring.ts`; the error names the variables, never their values).

**Revoking sessions.** A session is a row in `auth_sessions`; the bearer token the phone holds is
that row's token signed with `BETTER_AUTH_SECRET` (`<token>.<HMAC>`), and only the signed form is
accepted (`bearer({ requireSignature: true })`). A website session is the same kind of row with
`client = 'browser'`, delivered as the `__Host-ct_session` cookie instead; users revoke their own
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
`API_TOKENS` nor `DATABASE_URL` is set, so it never reaches a Neon database. The app's mock accounts
(admin@ and demo@cityturfer.com, code `000000`, Gdańsk demo data) exist on PGlite only, for the same
reason.

## Migrations

| Migration                    | Contract | What                                              |
| ---------------------------- | -------- | ------------------------------------------------- |
| `0000_init`                  | 0.3.0    | users, consents, activities, tracks, gap routes … |
| `0001_activity_renamed_at`   | 0.4.0    | `activities.renamed_at` (rename, last write wins) |
| `0002_auth`                  | 0.4.0    | Better Auth `auth_*` tables, `rate_limits`        |
| `0003_exports`               | 0.4.0    | `data_exports`, `stored_files` (export zips)      |
| `0004_browser_sessions`      | 0.5.0    | `auth_sessions.client`, `absolute_expires_at`     |
| `0005_turf`                  | 0.6.0    | `turf_claims`, `turf_cells`, `users.turf_version` |
| `0006_turf_claim_track_hash` | 0.6.0    | `turf_claims.track_hash` (rollback repair)        |

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

The web portal reaches the API through the website's route `/api/v1/*` → this API's `/v1/*`
(`apps/web/vercel.json`); the browser holds an `HttpOnly` cookie on the website's host. Local runs
cannot prove the Vercel hops.

**Client IP: what the API trusts** (`clientIp` in `apps/api/src/client-ip.ts`, decision W9 in
`docs/decisions/api-web-sessions-2026-10-22.md`). Vercel documents that it overwrites
`x-forwarded-for` "to prevent IP spoofing", and that `x-vercel-forwarded-for` survives a proxy in
front; it never says a client-sent `x-vercel-forwarded-for` is stripped. So a direct caller (the
phone, or anyone calling `city-turfer-api.vercel.app`) is bucketed by the last `x-forwarded-for`
entry, then `x-real-ip`; `x-vercel-forwarded-for` counts only when the request carries
`cityturfer-edge: $WEB_EDGE_SECRET`, which the website's route sets (a `routes` transform with
`op: "set"`, so a visitor's own value is replaced). `apps/web/vercel.json` has that route since
v0.10.0:

```json
"routes": [
  {
    "src": "^/api/v1/(.*)$",
    "dest": "https://city-turfer-api.vercel.app/v1/$1",
    "transforms": [
      {
        "type": "request.headers",
        "op": "set",
        "target": { "key": "cityturfer-edge" },
        "args": "$WEB_EDGE_SECRET",
        "env": ["WEB_EDGE_SECRET"]
      }
    ]
  }
]
```

It needs `WEB_EDGE_SECRET` on the website's Vercel project too (Production and Preview, the same
values as on this API). Until both are set, web visitors fall back to the address that reaches the
API (probably a Vercel one, shared by all of them): the per-address limits still hold.

**The preview pair.** `apps/web/vercel.json` always routes to the **production** API
(`city-turfer-api.vercel.app`), so a web preview built from a normal branch never reaches an API
preview: testing the portal on such a preview tests it against production. To test a pair:

1. **API preview.** Push the API branch. In the API project, set for that branch only (Settings →
   Environment Variables → Preview → the branch): `DATABASE_URL` of its own Neon branch (migrations
   up to `0006` applied, see above), `BETTER_AUTH_SECRET`, `AUTH_FIXED_CODE` if Maestro needs it,
   `WEB_EDGE_SECRET` (a preview value), and `WEB_ORIGIN` = the web preview's branch URL from step 2.
   Redeploy. Note the API's **branch URL** (`city-turfer-api-git-<branch>-<team>.vercel.app`; it
   stays the same across pushes; copy it from the dashboard, long names are shortened).
2. **Web preview on a throwaway branch.** From the web branch, create a short-named branch (e.g.
   `tmp/portal-pair`) that is **never merged** (no PR into `scope/…`; delete it afterwards). On it,
   change only the route's `dest` in `apps/web/vercel.json` to `https://<API branch URL>/v1/$1`. If
   the API project's previews are behind Vercel Authentication, also set the header
   `x-vercel-protection-bypass` in the same `transforms` from an env var of the web project
   (Protection Bypass for Automation secret of the API project), or the website gets the login page
   instead of the API. Set `WEB_EDGE_SECRET` on the web project for that branch (the API preview's
   value). Push; open the web preview's **branch URL** (the one in `WEB_ORIGIN`), not a per-commit
   URL, or every write is `403 auth.csrf`.
3. Run the checks below, in Chrome and Safari. Then delete the throwaway branch and its env
   overrides.

Checks:

1. **Cookie:** sign in on `/en/account`; DevTools shows `__Host-ct_session` on the website's host,
   `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, no `Domain`; `/api/v1/*` requests carry it;
   sign-out removes it.
2. **CSRF headers and the query pass through:** writes (sign-out, consents) answer 204/200, not
   `403 auth.csrf` (the route must keep `Origin` and `Sec-Fetch-Site`); "sign out other devices"
   (`DELETE …/auth/sessions?scope=others`) answers 204, not 400 (the query string survives the
   route).
3. **Client IP, through the website:** temporarily compare what `clientIp` returns with your public
   IP, through a throwaway preview-only log line or a debugger — never committed and never in
   production logs. It must be your IP, also when you send a forged `x-vercel-forwarded-for` and
   `cityturfer-edge: guess` to the website. If it is a Vercel address, all web users share one
   bucket (20 failed sign-ins / 30 codes per 10 minutes): record it and decide on Vercel Firewall
   rate limits before launch.
4. **Client IP, direct call:** send forged headers straight to the API preview's host (a wrong code,
   so no mail is sent; add `-H 'x-vercel-protection-bypass: …'` if previews are protected):

   ```bash
   curl -s -X POST "https://<API branch URL>/v1/auth/sign-in" -H 'content-type: application/json' \
     -H 'x-vercel-forwarded-for: 198.51.100.1' -H 'x-real-ip: 198.51.100.2' \
     -H 'x-forwarded-for: 198.51.100.3' -H 'cityturfer-edge: guess' \
     -d '{"email":"probe@e2e.cityturfer.test","code":"000001"}'
   ```

   With the same throwaway log line, the API must see your real IP, none of the forged ones. If the
   last `x-forwarded-for` entry is a forged one, stop: the direct-call rule in
   `apps/api/src/client-ip.ts` must change before launch.

5. **No edge caching:** personal answers carry `Cache-Control: private, no-store` and
   `x-vercel-cache` is absent or `MISS`.
6. **Sign out everywhere** (`scope=all`) revokes the phone's session too, but the phone shows no
   sign-in screen: it stays signed in locally and keeps all its data. Its next foreground backup
   fails with kind `auth`, and the Cloud backup card (Info › Cloud backup) says "Your sign-in has
   expired. Sign in again to carry on backing up."; once the user signs in again, backup carries on.
   That is the expected result (device check). A real sign-out on the phone after a `401` would be a
   separate app change.

## Accounts: adopting the existing `admin` data

The founder's history lives under user `admin` (today's device-token user). Before signing in on the
phone with a code, give that user the e-mail, so the account **is** `admin` (no data copied):

```bash
DATABASE_URL='<neon url>' pnpm --filter @cityturfer/api run auth:adopt -- admin <your e-mail>
```

It refuses when the e-mail already belongs to another account (delete that one first with
`DELETE /v1/me`). Without `DATABASE_URL` it works on the local PGlite (stop the dev server first).
The device token keeps working for the same user until it is removed from `API_TOKENS`.

## Server turf: migrate, deploy, backfill (v0.10.0, contract 0.6.0)

From 0.6.0 the server claims turf in every upload's transaction and serves it (`/v1/turf/summary`,
`/v1/turf/cells`, `/v1/turf/claims/{id}`; design `docs/decisions/api-server-turf-2026-10-23.md`).
Activities uploaded before have no claim until the backfill. **The founder runs the production
backfill.**

> **Migrate `0005_turf` and `0006_turf_claim_track_hash` before merging `release/vX.Y.Z` → `main`.**
> That merge deploys 0.6.0, which reads `users.turf_version` on every request that loads the
> account: without the migration `/v1/me`, every upload and every turf route answer **500**. Check
> `GET /v1/health` on the current deployment after migrating, then merge.

Order:

1. **Migrate** production to `0006_turf_claim_track_hash` (section above) **before the merge**:
   additive, the running 0.5.0 code ignores the new tables and column.
2. **Deploy** (merge `release/vX.Y.Z` → `main`); check `GET /v1/health` answers `version: 0.6.0`,
   `database: ok`. New uploads claim from now on.
3. **Backfill** from a trusted machine, against the direct (unpooled) connection. First see what
   cannot be claimed — activities without a track (uploads always carry one; any row here is a
   repair case for support, never shared outside):

   ```sql
   -- Activities without a claim that have no track row, or a track without points, per user.
   SELECT a.user_id, count(*) AS untracked
   FROM activities a
   LEFT JOIN activity_tracks t ON t.user_id = a.user_id AND t.activity_id = a.id
   WHERE NOT EXISTS (SELECT 1 FROM turf_claims k WHERE k.user_id = a.user_id AND k.activity_id = a.id)
     AND (t.activity_id IS NULL OR jsonb_array_length(t.points) = 0)
   GROUP BY a.user_id;
   ```

   ```bash
   DATABASE_URL_UNPOOLED='<neon production url>' pnpm --filter @cityturfer/api run turf:backfill -- --dry-run
   DATABASE_URL_UNPOOLED='<neon production url>' pnpm --filter @cityturfer/api run turf:backfill
   # one account only: … run turf:backfill -- --user <userId>
   # bounds of one run (defaults 20000 activities, 30 minutes): … -- --max 5000 --minutes 10
   ```

   One activity per locked transaction, oldest first per user: idempotent and resumable (stop it any
   time, run it again; a second run claims 0) and safe while phones upload. A run stops at its
   budget or deadline (`Stopped (budget; run again to continue)`). It prints counts only
   (`user 3/12: 40 claimed, …`), never ids of cells or coordinates. `deferred` = a start in the
   future (a phone clock ahead): the daily cron claims it once due. `skipped` = activities without a
   track (the query above): never attempted, by this run, later runs or the cron, so they cannot
   keep either busy; they are reported on every run until support repairs or erases them (a later
   upload with a track claims at once). `failed` > 0 exits 1: a failed claim is passed over for the
   rest of the run (the user's newer activities still claim) and tried first by the next. Re-run; if
   it stays, look at the error class it printed and find the account with `user:find` (its unclaimed
   count stays above 0 after a full run). `user:find` shows "turf: N claims, M activities unclaimed,
   K without a track" per account. The backfill never re-creates an account erased while it runs.

4. **Then the web map** (the website's turf pages) may ship: before the backfill, users who uploaded
   earlier see partial turf.

**Rollback** (redeploy 0.5.0 code): the turf tables stay but 0.5.0 does not maintain them. Its
deletes and withdrawals cascade claims away with their activities **but leave their Turf Cells**,
and its replaces change the track, type or start in place **under the old claim**, so turf derived
from erased, withdrawn or trimmed-away data would stay and be served again (personal data that must
be gone, decision B5). Size the repair with `turf:rebuild -- --dry-run` before redeploying 0.6.0;
keep the web turf pages off; then, **immediately after the redeploy**, run `turf:rebuild` and then
`turf:backfill`, and only then turn the web turf pages back on (until the rebuild, `/v1/turf/*`
serves the stale turf):

```bash
DATABASE_URL_UNPOOLED='<neon production url>' pnpm --filter @cityturfer/api run turf:rebuild -- --dry-run
DATABASE_URL_UNPOOLED='<neon production url>' pnpm --filter @cityturfer/api run turf:rebuild
# one account only: … run turf:rebuild -- --user <userId>
DATABASE_URL_UNPOOLED='<neon production url>' pnpm --filter @cityturfer/api run turf:backfill
```

`turf:rebuild` recomputes each user's Turf Cells from the claims that remain, one locked transaction
per user, only where they differ (a user with cells and no claims loses them all), then re-claims
every claim whose activity's track hash, type or start no longer matches (`N claims re-claimed`); a
second run finds nothing (`0 rebuilt`) and changes no turf version. Counts only; it skips accounts
erased meanwhile without re-creating them; `failed` > 0 exits 1. Then the backfill claims what 0.5.0
uploaded (the cron would too, 25 a day).

## Retention cron

`apps/api/vercel.json` schedules `GET /internal/cron/retention` daily at 03:00 UTC (Hobby runs daily
crons once within that hour; crons run on production deployments only). It deletes export zips past
their 24 h expiry (they hold GPS tracks; before this they were deleted only when the next export was
requested), expired sign-in codes and sessions, and stale rate-limit counters, and logs the counts
(`retention.purged`). It then **catches up turf**: at most 25 activities without a claim, about 60 s
at most (deferred future starts once due, anything the backfill missed), and answers and logs counts
only (`turf: { claimed, deferred, skipped, failed, remaining }`, `turf.caught-up`; activities
without a track are `skipped`, never attempted, so they cannot use up the 25); a turf failure never
fails the run (`turf: null`, `turf.catch-up-failed` with the error class). The bulk backfill is the
script above, not the cron. The route is internal: outside `/v1` and the OpenAPI spec, 401 without
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

The staff admin portal (`apps/admin`) is a scaffold with staff sign-in only and is not deployed; it
has no user data until the audited `/internal/admin` routes exist. Support runs two scripts from a
trusted machine against the production database (`DATABASE_URL_UNPOOLED` or `DATABASE_URL` in your
shell; without one they use the local PGlite — stop the dev server first). They print ids, e-mails,
counts, times and consents only: never coordinates, tracks, activity names or the Home City. Don't
paste their output into tickets or chats beyond what the request needs.

```bash
pnpm --filter @cityturfer/api run user:find -- <userId|email>
pnpm --filter @cityturfer/api run user:delete -- <userId>         # dry run: shows what goes
pnpm --filter @cityturfer/api run user:delete -- <userId> --yes   # erases
```

`user:find` prints id, `email`, `signInEmail`, `createdAt`, activity and tombstone counts,
`lastActivityAt` (latest activity end), `lastUploadAt`, sessions, exports, consents and `turf`
(claims, activities without a claim that have a track, and those without a track), then the line
`turf: N claims, M activities unclaimed, K without a track`. `user:delete` takes the **id** (not an
e-mail) and runs the same EraseAccount use case as `DELETE /v1/me`: every row of the account in one
transaction (auth rows and pending codes, consents, activities, tracks, gap routes, tombstones, Home
City, exports and their zips).

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

- `GET /v1/health` → `{"status":"ok","version":"0.6.0","coreVersion":"0.10.0","database":"ok"}` for
  the v0.10.0 release (`version` is the contract, `coreVersion` the `@cityturfer/core` package)
  (`not-configured` without `DATABASE_URL`, `unreachable` when Neon does not answer).
- `GET /v1/me` with `Authorization: Bearer <token>` → the user; 401 `auth.invalid` when the hash is
  not in `API_TOKENS`.
- Swagger at `/swagger` on the deployment ("Authorize" with the token).
- Logs: one JSON line per request (route pattern, status, ms, request id); never bodies, ids,
  coordinates or tokens. An unexpected error adds one `request.error` line: request id, method,
  route pattern, error class, a short code (e.g. Postgres `23505`) and its cause's, and the
  `file:line:col` of the first stack frame — never the error message (database messages quote the
  query's values). Find the request by its id, then the code location in the bundle.
