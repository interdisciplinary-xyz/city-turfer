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
  truth) and is checked in the API, the web portal and the admin portal; built by its own session in
  its own worktree, lighting up as the portal lanes land
---

# Testing the sync chain: phone → API → web portal and admin

Four apps, one source of truth:

```
apps/mobile (the original, SQLite)
   │  opt-in backup, run by the phone (no background sync)
   ▼
apps/api (the server copy, Postgres)  ── recomputes every number with @cityturfer/core
   ├──▶ apps/web portal   reads /v1 for the signed-in user (read-only, plus account actions)
   └──▶ apps/admin        reads /internal/admin/v1 (counts and dates, never a track)
```

The question this plan answers: **when something changes on the phone, does every other app show the
same change, with the same numbers, and nothing it shouldn't?**

## The approach: drive from the phone, observe everywhere

The founder's proposal is to test only from `apps/mobile`. That is the right centre, with three
adjustments:

1. **The phone triggers; the other apps are observed through their public surfaces.** The suite
   lives in `apps/mobile` and runs the phone's real code (`wire()`, real SQLite, the real
   `FetchApiClient`). It never imports `apps/api`, `apps/web` or the admin app (the dependency rules
   forbid it, and an import would test a shortcut, not the product). It checks the API over HTTP,
   the admin over its audited API, and the web portal in a browser.
2. **A few changes start elsewhere and land on the phone.** Signing out everywhere, deleting the
   account on the web, or a staff erasure all reach the phone (its token dies, backup stops, local
   data must stay). These reverse scenarios are still asserted on the phone.
3. **Most of it runs in Jest, not on a simulator.** A phone in Jest with the real wiring and fake
   device ports runs a scenario in seconds. Maestro and a real device cover only what Jest can't:
   the UI path and the device itself.

**Phase 0 is built** (`pnpm test:chain`): the scenarios live in
`apps/mobile/src/__tests__/chain/phone-to-server.test.ts`, the helpers in
`apps/mobile/src/test-support/chain/`, the runner in `tools/chain/run.mjs`. They replace the old
`live-api.integration.test.ts`, which could not pass against a real server: its second phone asked
for a sign-in code for the same address within a minute and got `429` (one code per address per
minute, by design). The chain's sign-in waits out `Retry-After` the way a user would.

## Test layers

| Layer                 | What runs                                                                                                | Where                                    | Speed    | When                          |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------- | ----------------------------- |
| L1 Contract twin      | The same scenarios against the in-memory FakeApiServer and the real API; both must give the same answers | Jest in apps/mobile                      | seconds  | `pnpm test` (fake), CI (both) |
| L2 Chain (main layer) | Phone in Jest → real API on PGlite → API, admin and web observers                                        | Jest in apps/mobile + Playwright for web | ~1–3 min | CI on PRs into scope, nightly |
| L3 Phone UI           | Maestro flow: sign in with a code, turn on backup, record, back up; then the observers check the result  | iOS Simulator, apps/mobile/e2e           | ~10 min  | before scope → release        |
| L4 Device             | Real iPhone: back up, reinstall, restore; background recording makes no network call                     | device, by hand (mobile-testing skill)   | by hand  | release checklist             |

**L1 matters more than it looks.** Almost every cloud-backup unit test runs against
`apps/mobile/src/contexts/cloud-backup/test-support/fake-api-server.ts`, a hand-written copy of the
contract. When the real API changes, the fake can quietly stay behind and the unit tests keep
passing. Running each scenario against both catches that drift.

## Scenarios

Every scenario starts on the phone and is checked in all four places. "—" means nothing should
change there, and the test asserts that too. **Live from** says which lane of the portals execution
plan (portals-execution-2026-10-22, in docs/plans) makes the column testable; until then that
observer reports _pending_, never _pass_.

### Phone → everywhere

| #   | On the phone                                         | API (`/v1`)                                                                          | Web portal                                                   | Admin                                                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------- |
| S1  | Turn on backup with 3 activities, run backup         | 3 activities; each summary equals the phone's (distance to 1 m)                      | List shows 3, same distances and durations, "Last backed up" | Count 3, last backup time; audit row for the staff read |
| S2  | Record a run (fixes through `IngestFixes`), finish   | Nothing while recording; on finish the outbox starts a foreground run and it arrives | Shows after reload                                           | Count +1                                                |
| S3  | Rename an activity                                   | New name, `renamedAt` wins                                                           | New name in list and detail                                  | —                                                       |
| S4  | Delete an activity                                   | `410` tombstone; turf summary drops                                                  | Gone from list; turf smaller                                 | Count −1                                                |
| S5  | Choose Home City                                     | Stored with `chosenAt`                                                               | "Your city" shows it                                         | — (location data never reaches the admin)               |
| S6  | Import Apple Health workouts, Health sharing **off** | No `hk-*` activity                                                                   | Persistent "Apple Health workouts stay on your phone" line   | —                                                       |
| S7  | Turn Health sharing on, run backup, then turn it off | `hk-*` arrive with source Apple Health, then are erased                              | Shown, then gone                                             | Count up, then down                                     |
| S8  | Withdraw backup consent                              | Server copy erased, no tombstones                                                    | "You turned backup off" empty state                          | Backup off, count 0                                     |
| S9  | Request an export                                    | Export job; link e-mailed (MemoryMailer / printed code)                              | Shows the pending export                                     | Request listed (when the requests view exists)          |
| S10 | Delete the account                                   | `/v1/me` → 401 for every session                                                     | Session dead → sign-in page                                  | Account erased; erasure log row kept without the e-mail |
| S11 | New phone B, same account: restore                   | Unchanged (restore only reads)                                                       | Unchanged                                                    | —                                                       |
| S12 | Backup run fails half-way (network drops), retry     | Never half an activity; after retry, same as S1                                      | Never shows a partial activity                               | Count only moves on complete uploads                    |
| S13 | Record in the background                             | **No request at all** (the GPS task is offline by rule)                              | —                                                            | —                                                       |

S13 is not in the chain suite: a foreground phone in Jest cannot prove it. It stays with
`apps/mobile/src/__tests__/headless-offline.test.ts` and the device check (layer L4).

### Elsewhere → phone (asserted on the phone)

| #   | Trigger                       | Expected on the phone                                                                 | Live from         |
| --- | ----------------------------- | ------------------------------------------------------------------------------------- | ----------------- |
| R1  | Web: sign out on all devices  | Next backup run gets 401 → backup shows signed out; every activity and turf cell kept | lane D (sessions) |
| R2  | Web: delete account           | Same as R1; restore offer gone                                                        | lane A slice 0    |
| R3  | Admin: staff erasure or block | Same as R1; a new sign-in with that e-mail is refused while blocked                   | lane D (admin), B |
| R4  | Web changes a consent         | Not in v1 (web plan slice 2); listed so the suite gets it when it lands               | later             |

### Checked in every scenario

- **Same numbers everywhere.** Activity count exact; distance within 1 m, duration to the second,
  turf cell count exact. The phone and the API both compute with `@cityturfer/core`, so any
  difference is a bug, not rounding. Turf parity starts with lane C (gate G2 in the admin plan).
- **The phone never loses data from a server-side action** (founder decision B4): snapshot the
  phone's activities and turf before and after S8, S10 and R1–R3, and require them equal.
- **Idempotent:** a second backup run right after the first uploads nothing.
- **Privacy:** no admin response holds coordinates, a track, bbox, preview or Health payload (gate
  G9); no coordinates or cell ids in a portal URL; the API's log lines for the whole run contain no
  coordinates (scan the captured output).

## How it runs

### The chain runner

One command starts everything on throwaway data and runs the suite:

1. API on PGlite with `AUTH_FIXED_CODE=000000`, on a **free port and a temp data folder**. Today
   `apps/api/src/server.ts` always uses port 8787 and `apps/api/.data/pglite`, the same as the dev
   server, so a chain run would share data with your local dev session. Prerequisite P1 below fixes
   that.
2. The web portal and the admin dev servers, pointed at that API (once they exist).
3. Jest with `CITYTURFER_LIVE_API` set: the phone scenarios plus the API and admin observers.
4. Playwright for the web observer: it reads a small hand-off file the Jest run writes (test e-mail,
   expected counts and totals) and checks the pages show the same. Never coordinates in the hand-off
   file.

Test accounts are `@e2e.cityturfer.test` only, made fresh per scenario, so runs never collide. Never
Neon, never real user data.

### Observers

| Observer | Talks to                                                | Signs in as                                     | Pending until                                 |
| -------- | ------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| API      | `/v1/*` with the phone's bearer token                   | the test user                                   | live today                                    |
| Admin    | `/internal/admin/v1/*` (the audited routes)             | a test staff assertion (P2)                     | lane D admin routes                           |
| Web      | the portal pages in Chromium, through `/api/v1` rewrite | the test user, by code, with the session cookie | lane A slice 0 (account), slice 1 (list, map) |

An observer whose route answers 501 or whose app isn't there reports _pending_ with the reason. The
run's summary lists pending checks separately; a pending check is never counted as a pass.

### In CI

- `pnpm test` keeps running only the fake half (fast, no network), as today.
- A new CI job runs the chain runner on PRs into `scope/*` and nightly. PGlite only.
- The scope → release PR needs a green chain run, plus Maestro and the device checks.

## Prerequisites (small changes outside the test folders)

| #   | Change                                                                                                    | Owner (skill)                 |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------------- |
| P1  | **Done:** the API dev server takes `PGLITE_DIR=<folder>` or `PGLITE_DIR=memory` (and `PORT`)              | api-engineer (api-design)     |
| P2  | A test-only staff assertion for PGlite (refused in production, like `AUTH_FIXED_CODE`)                    | api-engineer, with lane D     |
| P3  | `testID`s the Maestro backup flow needs on the backup card                                                | mobile-ui-engineer            |
| P4  | CI job and a `test:chain` script; the verify-change skill names it for cloud-backup, API and portal diffs | harness-engineer (ai-harness) |

## Who does what

| Work                                                                 | Agent                | Skill                         |
| -------------------------------------------------------------------- | -------------------- | ----------------------------- |
| Lead: chain runner, phone driver, scenarios S1–S13, L1 contract twin | mobile-test-engineer | mobile-testing, verify-change |
| P1, P2; the API observer's expectations                              | api-engineer         | api-design                    |
| Turf parity (S1, S4) once server turf lands                          | location-engineer    | turf-territory                |
| Web observer (Playwright pages, empty states, R1–R2)                 | portal-engineer      | web-portal                    |
| Admin observer (counts, audit rows, G9, R3)                          | admin-engineer       | admin-portal                  |
| Maestro backup flow (L3), new critical path in `docs/quality/e2e.md` | mobile-test-engineer | mobile-testing                |
| P4 (CI, script, skill update)                                        | harness-engineer     | ai-harness                    |
| Review each PR                                                       | mobile-reviewer      | —                             |

## Order of work

| Phase | Needs                   | Delivers                                                                                                 |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| 0     | nothing (today's API)   | P1; chain runner; S1–S8, S10–S12 with the API observer; L1 twin; CI job (P4)                             |
| 1     | lane D routes           | P2; admin observer: S1, S4, S7, S8, S10 counts, audit rows, G9; R1, R3                                   |
| 2     | lane A slice 0          | Web observer on the account page: S8, S9, S10, R2                                                        |
| 3     | lane C + lane A slice 1 | Turf parity everywhere; web list, detail and map for S1–S7                                               |
| 4     | lane B views            | Admin observer through the Payload views in a browser (gate G11)                                         |
| 5     | before release          | L3 Maestro backup flow with the observers; L4 device checks from `docs/plans/backend-plan-2026-10-22.md` |

Phase 0 is built: S1–S8 and S10–S12 against the API (S9 still to do; S13 see above). It is useful on
its own: it checks the whole phone → API path, which ships today, and the scenarios it adds stay
valid as each portal lands.

## Running it as an independent session

So it never collides with the portal lanes or anyone's uncommitted work:

- **Own worktree and branch:** `test/sync-chain` cut from `origin/scope/v0.10.0`, in a separate
  worktree (e.g. `../turf-track-sync-chain`). One PR per phase into `scope/v0.10.0`.
- **Owns only new test paths:** a chain folder under `apps/mobile/src/__tests__/`, its helpers under
  `apps/mobile/src/test-support/`, the runner under `tools/`, and `docs/quality/e2e.md` rows. P1–P4
  go through their owners as small PRs.
- **Own ports and data:** never the dev server on 8787, never `apps/api/.data`.
- **Doesn't wait on the lanes:** pending observers light up on their own when a lane merges and the
  branch is rebased.

Kickoff prompt for the session (run from the new worktree):

> Read `docs/plans/sync-chain-testing-2026-10-22.md`. You lead it as mobile-test-engineer, using the
> mobile-testing and verify-change skills. Phase 0 is built (`pnpm test:chain`); continue on
> `test/sync-chain`: S9 (export), the Maestro backup flow, then phase 1 as lane D lands. Report
> pending checks as pending. Open PRs into `scope/v0.10.0` with ship-branch; never merge.

## Decisions

| #   | Decision                                  | Recommendation                                                                                                   |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| T1  | Drive only from the phone?                | Yes for triggers and the suite's home; observe the other apps over HTTP and a browser; keep R1–R3                |
| T2  | Where the web observer's Playwright lives | In the portal's Playwright setup (the planned apps/web/e2e folder), as a chain project reading the hand-off file |
| T3  | Chain run on every PR or nightly only?    | PRs into `scope/*` and nightly; not on feature branches, to keep them fast                                       |
| T4  | Fake API kept?                            | Yes, for fast unit tests, held honest by the L1 twin                                                             |
