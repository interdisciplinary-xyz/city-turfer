---
status: proposed
verified: 2026-10-22
owner: founder
scope:
  [
    apps/mobile/src/__tests__/chain,
    apps/mobile/src/test-support/chain,
    tools/chain/run.mjs,
    apps/mobile/src/contexts/cloud-backup,
    apps/mobile/e2e,
    apps/api/src/server.ts,
    docs/quality/e2e.md,
  ]
summary:
  How to test that the four apps stay one system — every scenario starts on the phone (the source of
  truth) or reaches it, and is checked in the API, the web portal and the admin portal as each is
  built today; scenarios report pending until the routes they need exist
---

# Testing the sync chain: phone → API → web portal and admin

Four apps, one source of truth:

```
apps/mobile (the original, SQLite)
   │  opt-in backup, run by the phone in the foreground (also right after an activity is saved)
   ▼
apps/api (the server copy, Postgres)  ── recomputes every number with @cityturfer/core
   ├──▶ apps/web portal   reads /v1 for the signed-in user; account actions (sign-out, export, delete)
   └──▶ apps/admin        staff only; user data later through /internal/admin/v1 (never a track)
```

The question this plan answers: **when something changes on the phone, does every other app show the
same change, and nothing it shouldn't? And when another app acts on the account, does the phone
react without losing anything?**

## The approach: drive from the phone, observe everywhere

The founder's proposal is to test only from `apps/mobile`. That is the right centre, with three
adjustments:

1. **The phone triggers; the other apps are observed through their public surfaces.** The suite
   lives in `apps/mobile` and runs the phone's real code (`wire()`, real SQLite, the real
   `FetchApiClient` and `ApiAuthGateway`). It never imports `apps/api`, `apps/web` or the admin app.
   It checks the API over HTTP and the web portal by making the portal's own requests.
2. **Some changes start on the web and land on the phone.** The portal can sign phones out and
   delete the account. Those scenarios are asserted on the phone: backup stops, local data stays.
3. **Most of it runs in Jest, not on a simulator.** Maestro and a real device cover only what Jest
   can't: the screens and the device itself.

**Built:** `pnpm test:chain` (runner `tools/chain/run.mjs`, scenarios in
`apps/mobile/src/__tests__/chain/`, helpers in `apps/mobile/src/test-support/chain/`). It replaced
`live-api.integration.test.ts`, which could not pass against a real server (its second sign-in for
the same address always hit the one-code-a-minute `429`).

## What each app can see today (2026-10-22)

| App                 | State                                                   | What a phone change can show there                                                                        | What it can do to the phone                                                    |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| API                 | `scope/v0.10.0`, contract 0.5.0 (with account settings) | Everything: activities with recomputed numbers, tombstones, consents, Home City                           | —                                                                              |
| Web portal, Slice 0 | PR #141 (`feat/web-portal`), contract 0.5.0             | Privacy & data: account e-mail, backup and Apple Health consent state with dates, signed-in devices       | Sign out one device, others or all (phones included); delete account; export   |
| Account settings    | **Merged** into `scope/v0.10.0` (#142), contract 0.5.0  | Name and e-mail on `/v1/me` for every session                                                             | E-mail or password change signs out every **other** session, browsers included |
| Web portal, Slice 1 | planned                                                 | Activities list, detail, turf map (needs server turf, lane C)                                             | —                                                                              |
| Admin               | PR #139 (`feat/admin-portal`): staff sign-in            | Nothing yet. Its own Payload database holds staff only; user data waits for `/internal/admin/v1` (lane D) | Later: erasure, block                                                          |

The web portal shows **no activities, counts, "last backed up", Home City or turf** in Slice 0
("what we store" is static copy). So a recording, rename, delete or Home City change has nothing to
show on the web yet; those columns wait for Slice 1.

**#141 must now be merged with #142's API.** Both claimed contract 0.5.0 and changed the same eight
API files (identity routes, schemas, use cases, wiring, errors, `openapi.json`). #142 is in scope,
so #141 needs a real resolution by api-engineer before it merges. W1–W4 were verified against #141
on its own (below).

## Scenarios

"—" means nothing should change there. A scenario whose routes are missing reports **pending** with
the reason and is listed apart from the passes; it is never counted as passed.

### Phone → server (`phone-to-server.test.ts`, fake and live API)

| #   | On the phone                                        | API (`/v1`)                                                             | Web portal (Slice 0)                                  | Admin                    |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| S1  | Turn on backup with 3 activities, run backup        | 3 activities, same distance (1 m) and moving time (1 s); no refusals    | Backup "on since" (W1)                                | pending: lane D          |
| S2  | Record a run, finish                                | Nothing written while recording; on finish the outbox uploads it        | — (Slice 1)                                           | pending                  |
| S3  | Rename                                              | New name                                                                | — (Slice 1)                                           | —                        |
| S4  | Delete                                              | `410` tombstone; turf summary: pending (server turf, lane C)            | — (Slice 1)                                           | pending                  |
| S5  | Choose Home City                                    | Stored                                                                  | — (Slice 1)                                           | — (never: location data) |
| S6  | Apple Health workout, sharing off                   | No `hk-*` activity                                                      | Apple Health "off" (W1)                               | —                        |
| S7  | Sharing on, then off                                | `hk-*` arrives as Apple Health, then is erased; phone unchanged         | Apple Health "on", then "off" (W1)                    | pending                  |
| S8  | Turn backup off                                     | Copy and Home City erased, consent withdrawn; phone unchanged           | Backup "withdrawn" (W1)                               | pending                  |
| S9  | Request an export                                   | Export job                                                              | The web's own export is refused for the day (W2)      | pending                  |
| S10 | Delete the account                                  | Every session 401; backup notes `auth`, waits for a sign-in; phone kept | Not checked here (W4 covers delete from the web side) | pending                  |
| S11 | New phone, same account: restore                    | Unchanged; no refusals on either phone                                  | Not checked yet (devices list would show both phones) | —                        |
| S12 | Network drops mid-backup (before send, answer lost) | Never half an activity; the retry completes it                          | —                                                     | —                        |
| S13 | Record in the background                            | No request at all                                                       | —                                                     | —                        |

S13 is not in the chain suite: a foreground phone in Jest cannot prove it. It stays with
`apps/mobile/src/__tests__/headless-offline.test.ts` and the device check (layer L4).

### Phone ↔ web portal (`phone-and-web.test.ts`, live API with browser sessions)

The web observer signs in and calls the API exactly as the portal client (apps/web/src/api) does on
#141: an e-mailed code, `client: "browser"`, the `__Secure-ct_session` cookie, and `Origin`,
`Sec-Fetch-Site` and `CityTurfer-Client: web/…` on writes. It reads only what the pages show.

| #   | Steps                                                                                                                         | Checked                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Phone backs up; web signs in; phone turns Health on and off, backup off and on; web signs the phone out from the devices list | Web shows the e-mail, backup on/withdrawn/on, Health on/off, one phone and this browser; after "sign out" the phone's backup stops with `auth` and waits; phone data kept; browser still signed in |
| W2  | Phone requests an export; web asks for one; web signs out                                                                     | Web export refused (`429`, one a day per account); web cookie cleared; the phone stays signed in and its next activity still uploads                                                               |
| W3  | Web "Sign out everywhere" (`scope=all`)                                                                                       | Browser and phone both signed out; phone keeps everything                                                                                                                                          |
| W4  | Web deletes the account                                                                                                       | Cookie cleared, `/v1/me` 401; phone signed out, keeps everything                                                                                                                                   |

### Account settings from the phone (`account-settings.test.ts`, live API with account settings)

The phone side sends the requests its Account tab's gateway sends on #142, with its session token.

| #   | On the phone                                   | Checked                                                                                                                                                   |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Set a name, then clear it                      | A second phone on the account reads the name, then none                                                                                                   |
| A2  | Change e-mail (step-up code, new-address code) | Same account: backup keeps going to the same copy, no refusals; the other phone is signed out; a new phone signing in with the new address finds the copy |
| A3  | Set a password                                 | The other phone is signed out, this one isn't; a new phone signing in with the password finds the backup                                                  |

When #141 and #142 are both in, add: **A4**, an e-mail or password change on the phone signs the web
portal out. The API does it today, because browsers use the same sessions table.

### Checked in every scenario

- **Same numbers:** count exact, distance within 1 m, moving time within 1 s; turf cells exact once
  server turf exists.
- **The phone never loses data from a server-side action** (decision B4): S7, S8, S10, W1, W3, W4.
- **No silent refusals:** no write outside sign-in answered ≥ 400 (a 412 retry behind an "ok").
- **Idempotent:** a second backup run writes nothing.
- **Privacy:** the API's log for the whole run holds no coordinates (the runner fails otherwise).

## How it runs

`pnpm test:chain`:

1. Starts the API on a free port, bound to 127.0.0.1, with an in-memory PGlite database
   (`PGLITE_DIR=memory`) and `AUTH_FIXED_CODE=000000`. Never `apps/api/.data`, never Neon.
2. Runs the three chain files with Jest. Each scenario also runs against the fake API in plain
   `pnpm test`, so the fake can't drift from the API unnoticed.
3. Scans the API log for coordinates and lists pending checks.

Accounts are fresh `@e2e.cityturfer.test` addresses per run. Each simulated phone and browser sends
its own `x-real-ip`, as Vercel reports one per device; otherwise every client of a run would share
one per-IP sign-in bucket (30 codes per 10 minutes), which no real set of users does. The
per-address limits still apply in full, and the suite waits them out like a user: a second client on
an address waits about a minute. Jest runs the three files in parallel, so a full run takes about 5
minutes.

### Verified on 2026-10-22

| API under test                                      | Result                                                        |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `scope/v0.10.0` with #142 merged + this branch      | 22 passed, five full runs; A1–A3 pass; W1–W4 and turf pending |
| + `feat/web-portal` (#141), local merge before #142 | 22 passed; W1–W4 pass                                         |

One earlier full run failed W4 and A3 once and the details were lost; it did not come back in six
runs, also from a cold cache. Since then every scenario turns backup on with a helper that waits for
any backup run the app started in the background, and checks the outcome on the server and in the
backup status rather than in one run's report.

Two things the runs taught: turning backup on records the consent but uploads nothing until the next
run (the app starts one at once); and an export asked for on the phone uses up the website's export
for that day.

### In CI

- `pnpm test` runs the fake half, as today.
- A CI job for `pnpm test:chain` on PRs into `scope/*` and nightly (P4).
- The scope → release PR needs a green chain run, Maestro, and the device checks.

## Still to build

| #   | What                                                                                                     | Owner (skill)                         | Needs             |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------- |
| N1  | A4 (account change signs the web out) once #141 is in                                                    | mobile-test-engineer (mobile-testing) | #141 merged       |
| N2  | Switch account actions to `ApiAuthGateway`'s methods (on scope now) instead of raw requests              | mobile-test-engineer                  | —                 |
| N3  | Web Slice 1 columns: list, detail, map show S1–S7, same numbers                                          | portal-engineer (web-portal)          | lane C, Slice 1   |
| N4  | Admin observer: counts, audit row per staff read, no coordinates (G9); erasure and block reach the phone | admin-engineer (admin-portal)         | lane D routes, P2 |
| N5  | Browser rendering checks (Playwright) once the portal has a Playwright setup                             | portal-engineer                       | apps/web E2E      |
| N6  | Maestro backup flow (L3) with the API observer                                                           | mobile-test-engineer                  | P3                |
| P2  | A test-only staff assertion for PGlite (refused in production, like `AUTH_FIXED_CODE`)                   | api-engineer (api-design)             | lane D            |
| P3  | `testID`s on the backup card                                                                             | mobile-ui-engineer                    | —                 |
| P4  | CI job for `test:chain`; the verify-change skill names it for cloud-backup, identity, API, portal diffs  | harness-engineer (ai-harness)         | —                 |

## Decisions

| #   | Decision                          | Recommendation                                                                                  |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| T1  | Drive only from the phone?        | Yes for the suite's home and most triggers; also cover the web's actions on the phone (W1–W4)   |
| T2  | Web observer: HTTP or browser?    | HTTP mirror of the portal's client now (no Playwright setup exists); add browser checks with N5 |
| T3  | Chain run on every PR or nightly? | PRs into `scope/*` and nightly; not on feature branches                                         |
| T4  | Fake API kept?                    | Yes, for fast unit tests, held honest by running the same scenarios against both                |
| T5  | Per-device IPs in the chain       | Yes (`x-real-ip` per simulated client); per-address limits stay real                            |
