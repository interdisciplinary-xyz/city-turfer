---
status: canonical
verified: 2026-10-23
owner: founder
scope: [apps/api/src/identity, apps/api/src/routes/identity.ts, apps/api/scripts/auth-adopt.ts]
summary:
  Real accounts for backup and restore (contract 0.4.0) — sign-in with an e-mailed one-time code
  through Better Auth behind our own routes, our own Postgres rate limits, device tokens for one
  more release, auth:adopt for the existing admin data, production boot guards
---

# Accounts: e-mailed codes, sessions, adoption (contract 0.4.0)

On 2026-10-22 the founder chose sign-in by **e-mailed one-time code** (Better Auth `emailOTP`, mail
via Brevo) for the first release with real accounts: opt-in backup, restore to a new phone, rename,
export and account deletion. This record replaces T1 of
`docs/decisions/api-device-tokens-2026-10-20.md` (device tokens keep working for one release) and
narrows D7 of `docs/decisions/api-sync-2026-10-20.md` (Sign in with Apple later). Operations:
`docs/operations/api-deploy.md`. A1 is narrowed by `docs/decisions/account-settings-2026-10-22.md`
(contract 0.5.0): codes stay the default, a Turfer may add a password. Browser sign-in by cookie is
[`api-web-sessions-2026-10-22.md`](api-web-sessions-2026-10-22.md).

**Since this record (facts, not new decisions):** on the local dev server on PGlite, the app's mock
accounts (admin@ and demo@cityturfer.com, `apps/api/src/dev/mock-accounts.ts`, #151) also get
`AUTH_FIXED_CODE`, which defaults to `000000` there; never in the Vercel entry. The production boot
guard (A9) now also requires `DATABASE_URL` and `CRON_SECRET`, and `WEB_EDGE_SECRET` whenever
`WEB_ORIGIN` is set (`checkProductionEnv` in `apps/api/src/wiring.ts`). Sign-in codes still get 10
more minutes on a resend (Better Auth's `reuse`); step-up and new-address codes keep their first
expiry since #154 (`apps/api/src/identity/codes.ts`).

## Decisions

| #   | Decision         | Chosen                                                                                                                                                                                                                                                                                                                           | Rejected                                                                                                                          |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Sign-in          | 6-digit code by e-mail, 10 min, single use, 3 wrong tries burn it; a request while it is valid re-mails the same code (`resendStrategy: 'reuse'`), so asking for codes cannot void the user's; stored encrypted (AES-256-GCM, key from `BETTER_AUTH_SECRET`; `reuse` needs it recoverable); account created on the first sign-in | passwords; magic links (need deep links, a native change); hashed codes (`reuse` then rotates: anyone could void the user's code) |
| A2  | Library          | Better Auth 1.7 (`better-auth/minimal`, drizzle adapter, `bearer` + `emailOTP`), called via `auth.api.*` from our zod-openapi routes; telemetry and its logger off                                                                                                                                                               | mounting `auth.handler` (ungenerated spec, non-problem errors)                                                                    |
| A3  | Tables           | `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications` beside ours; the Better Auth user id **is** `users.id`                                                                                                                                                                                                      | Better Auth on `users` (mixes its columns with ours)                                                                              |
| A4  | Sessions         | bearer token = the session token signed with `BETTER_AUTH_SECRET` (`requireSignature`: the stored token alone is refused; rotating the secret revokes all), 60 days, sliding (refreshed when older than a day), no IP or user agent stored                                                                                       | JWTs (no revocation)                                                                                                              |
| A5  | Rate limits      | ours, in Postgres (`rate_limits`, fixed windows, HMAC keys): codes 3/e-mail and 30/IP, sign-ins 10/e-mail and 20 failed/IP, per 10 min; per e-mail 1 code a minute, and per day 10 codes and 10 failed sign-ins (slow brute force) → 429 `auth.rate-limited`; an IP is the IPv4 address or the IPv6 /64 (loose per IP: CGNAT)    | Better Auth's (runs only in `auth.handler`); Upstash now (D9 later)                                                               |
| A6  | Old tokens       | composite verifier: device tokens first (no database), then sessions                                                                                                                                                                                                                                                             | a hard cut-over                                                                                                                   |
| A7  | Existing data    | `auth:adopt -- <userId> <email>` creates the Better Auth user with the existing id: no copy                                                                                                                                                                                                                                      | migrating rows to a new id                                                                                                        |
| A8  | Test and dev     | `AUTH_FIXED_CODE` (six digits) outside production, **only for `@e2e.cityturfer.test` addresses** (checked server-side; real addresses always get random codes) for Maestro; the local server prints codes (ConsoleMailer); tests capture them (MemoryMailer)                                                                     | a backdoor account                                                                                                                |
| A9  | Production guard | `VERCEL_ENV=production` refuses to boot without `BETTER_AUTH_SECRET` (≥ 32), `BREVO_API_KEY`, `MAIL_FROM`, `API_PUBLIC_URL`, or with `AUTH_FIXED_CODE`                                                                                                                                                                           | degrade silently                                                                                                                  |

## Flow

1. `POST /v1/auth/codes` `{ email }` → `202 {}` always (unknown addresses too). While a code is
   valid and not burnt, a new request mails the same code again and extends it by 10 minutes.
2. `POST /v1/auth/sign-in` `{ email, code }` → `200 { token, expiresAt, user: { id, email } }`;
   wrong, expired or burnt → `401 auth.invalid-code`.
3. Requests send `Authorization: Bearer <token>`; `DELETE /v1/auth/session` revokes it.
4. `GET /v1/me` → `{ id, email | null, displayName, createdAt }` (device-token users: `email` from
   `API_TOKENS` or null). Since 0.5.0 also `name`, `hasPassword` and `passwordChangedAt`;
   `displayName` is deprecated (`account-settings-2026-10-22.md`).

## Privacy

E-mail addresses live in `auth_users` (and `users.email`) and, while a code is pending, in the
identifier of `auth_verifications`. Codes are stored encrypted (AES-256-GCM, key derived from
`BETTER_AUTH_SECRET`; a value that does not decrypt counts as no code). Rate-limit keys are HMACs of
the address or IP, deleted 25 h after their window started (the longest window plus an hour).
Nothing logs an address, a code or a token; the local dev server prints codes to its own console
only. A mail failure answers 202 and logs the event name only.

## Account deletion

`DELETE /v1/me` → `204`, synchronous: one transaction deletes `auth_users` (sessions and accounts
cascade), the pending codes for the address, and `users`, from which consents, activities (tracks,
gap routes, turf claims), tombstones, the Home City, turf cells and exports cascade. Afterwards the
session token answers 401; signing in with the same address starts a new, empty account. A device
token still authenticates until it is removed from `API_TOKENS` (its next request starts an empty
account). Rate-limit rows are HMAC-keyed and expire within about 25 hours. Database backups keep the
rows for Neon's restore window (to be stated with the plan).

## Data export

`POST /v1/me/exports` → `202 { id, status, requestedAt, readyAt, expiresAt }` + `Location`. A
`pending` row is reserved under the user's row lock (two concurrent requests cannot both pass the
one-per-24-h rule; `429 rate-limited` with `Retry-After`; `failed` and `expired` exports do not
count). The zip is built in the request by paging the changes feed (50 activities per page, their
tracks and gap routes in one query each) and streamed into fflate, so memory holds the compressed
output plus one page; above **50 MB** it fails. Contents: `data.json` (account, consents, activities
with tracks and gap routes, tombstones, Home City; no indentation) and one GPX 1.1 per activity, one
`<trkseg>` per segment. It is stored behind the `FileStorage` port (`stored_files`, Postgres
`bytea`, 24 h; Vercel Blob later) and a link `GET /v1/exports/{key}` is e-mailed (32 random bytes,
only the SHA-256 stored). No e-mail on the account → `422 export.no-email`.

**The link works repeatedly until it expires (24 h)**, not once: mail link scanners fetch links
before people do, and a broken download must be retryable. `GET /v1/me/exports/{id}` reports
`pending`, `ready`, `downloaded` (fetched at least once, still valid), `expired` or `failed`.
Expired files are purged daily (Vercel Cron, `GET /internal/cron/retention`, with expired codes,
sessions and stale rate-limit rows) and on the next export request. If building, storing or mailing
fails, the export is `failed`, its file deleted, and the user may ask again at once. Withdrawing a
consent deletes the user's export files and expires their links in the same transaction (they copy
the withdrawn data). A build still running at that moment cannot undo it: the export only becomes
`ready` while its row is still `pending`; otherwise the new zip is deleted and no link is mailed.

The download streams 256 KiB chunks without `Content-Length`. **Unverified until a deploy:** that
Vercel lets a streamed response exceed its 4.5 MB buffered-response cap. Duration: Fluid compute's
default (300 s) covers the build; `vercel.json` sets no `functions` pattern because a wrong pattern
for the bundled entry fails the build — add `maxDuration` once a deploy shows the entry path.

Why e-mail: the phone cannot save files without new native modules (`expo-file-system`,
`expo-sharing`), and the release must stay OTA.
