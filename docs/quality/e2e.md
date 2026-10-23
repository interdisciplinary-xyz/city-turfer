# E2E: critical paths and flow inventory

**Last reviewed:** 2026-10-18

The Maestro suite in `apps/mobile/e2e/` is the regression lock for what a runner does with the app.
Run it with `pnpm run test:e2e` (`apps/mobile/e2e/run.sh`, iOS Simulator, location pre-granted,
flows run in the order of `apps/mobile/e2e/config.yaml`). `pnpm run e2e:audit` (part of
`ci:quality`) statically checks that this document, `config.yaml`, the flows and the `testID`s in
`apps/mobile/src/` agree. It does not run the app.

Adapted from empatalk's `docs/quality/E2E.md`.

## 1. Critical paths

A critical path is a journey that, if broken, loses a user's data or breaks the product promise
(record, own the streets). Every row must name an existing flow, or say `unit-only` when there is
none; the audit enforces this. Gaps are listed honestly in section 3.

| ID    | Critical path                                                                                                                                               | Flows                               | Coverage                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CP-1  | Sign in (wrong password rejected, session survives restart), sign out                                                                                       | `01-auth`, `08-sign-out`            | Covered                                                                                                                          |
| CP-2  | Record a run, pause/resume, hold to finish, activity with turf gained                                                                                       | `02-record-run`, `04-too-short`     | Covered                                                                                                                          |
| CP-3  | Recording continues while the app is backgrounded (simulated walk)                                                                                          | `03-background-recording`           | Covered on simulator only                                                                                                        |
| CP-4  | Kill the app mid-recording and recover the session on relaunch                                                                                              | none, unit-only                     | Unit-only (`end-to-end.test.ts`)                                                                                                 |
| CP-5  | Turf appears after an activity and on the Turf map                                                                                                          | `02-record-run`, `06-turf-map`      | Covered                                                                                                                          |
| CP-6  | Deleting an activity releases its turf                                                                                                                      | `07-delete-activity`                | Row only: turf not asserted                                                                                                      |
| CP-7  | Dashboard: week stats, recent activities, achievements, Stats links                                                                                         | `10-dashboard`, `05-history-detail` | Covered                                                                                                                          |
| CP-8  | Me drawer: Profile, Account, City, Info, tap-outside closes, Achievements                                                                                   | `09-me-menu`                        | Covered                                                                                                                          |
| CP-9  | Apple Health: connect, import workouts with routes (iOS)                                                                                                    | `11-apple-health`                   | Simulator only; Watch on device                                                                                                  |
| CP-10 | Home City: pick a city (accent-free search) from Me and from the Record tab, Turf Map chip, clear it                                                        | `12-home-city`                      | Chip asserted; camera position checked by screenshot only                                                                        |
| CP-11 | Record tab turf toggle: on by default, hides and shows the turf, remembered, available while recording                                                      | `13-record-turf`                    | Toggle state asserted; the turf on the map checked by screenshot only                                                            |
| CP-12 | Account tab: with a code-signed-in account, rename (header shows it), change email, set the account password (breached refused), sign in with it, remove it | `15-account-settings`               | Needs the API dev server (`AUTH_FIXED_CODE`); not run on a device yet; about 2 min waiting out the 1-step-up-code-a-minute limit |
| CP-13 | Language setting: Polish on Info, Dashboard, Stats and Record, survives a restart, System brings English back (always left on System)                       | `16-language`                       | Simulator only; plural forms and long Polish words checked by screenshot                                                         |

## 2. Flow inventory

| Flow                      | Tag(s)                | Purpose                                                                                           |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| `01-auth`                 | auth                  | Wrong password rejected, demo account accepted, session persists                                  |
| `02-record-run`           | recording             | Live distance grows, pause/resume, finish, turf gained                                            |
| `03-background-recording` | recording, background | Home button, simulated 220 m walk, distance grew after foregrounding                              |
| `04-too-short`            | recording             | Fewer than 2 points: finish refused, Discard offered                                              |
| `05-history-detail`       | history               | Recent activities, See all, detail stats and turf gained                                          |
| `06-turf-map`             | turf                  | Demo history seeds turf; summary and type filters                                                 |
| `07-delete-activity`      | history               | Delete confirmation, row disappears from History                                                  |
| `09-me-menu`              | me                    | Drawer items, tap outside closes, Profile and Achievements                                        |
| `10-dashboard`            | dashboard             | Greeting, week distance, recent item, achievements, Stats to History                              |
| `11-apple-health`         | health                | iOS: connect Health, seed sample workouts, import 3 with routes                                   |
| `12-home-city`            | turf                  | Pick, change and clear the Home City from Me and the Record tab                                   |
| `13-record-turf`          | recording, turf       | Record tab turf toggle: default on, remembered, works while recording                             |
| `14-rename-activity`      | history               | Rename from the detail screen: empty name refused, new name in History                            |
| `15-account-settings`     | account               | Live API: rename, change email, set/breached/use/remove account password                          |
| `16-language`             | me                    | Language setting: Polish on Info/Dashboard/Stats/Record, restart keeps it, System returns English |
| `08-sign-out`             | auth                  | Sign out returns to sign-in. Runs last because it ends the session                                |

Allowed tags are fixed in `apps/mobile/tools/e2e/audit.mjs`
(`auth recording background history turf me dashboard health account`). Subflows in
`apps/mobile/e2e/subflows/` are not flows; `travel-*.yaml` are generated by
`apps/mobile/tools/e2e/gpx-to-travel.mjs` from GPX fixtures.

### Running `15-account-settings`

It talks to a real API, so it needs both ends set up (the app bundle is the part people forget):

```bash
AUTH_FIXED_CODE=000000 pnpm --filter @cityturfer/api dev                   # API on :8787 (PGlite)
EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 pnpm -C apps/mobile start        # Metro bakes the URL in
AUTH_FIXED_CODE=000000 apps/mobile/e2e/run.sh 15-account-settings
```

`run.sh` refuses the flow when the API is down; in a full run it then skips tag `account` and says
so. The flow makes up two `@e2e.cityturfer.test` addresses per run (nothing to clean up) and waits
out the one bucket it would otherwise hit: step-up codes are limited to 1 a minute per user, in a
bucket of their own (sign-in and new-address codes use the address's buckets, 1 a minute and 3 per
10 minutes, and the fresh addresses are asked once each). So it waits before the second and third
step-up code and spends about 2 minutes asleep on purpose.

## 3. Known gaps

- **CP-4 kill recovery has no Maestro flow.** Maestro cannot reliably kill the app mid-recording and
  keep the simulated route going. It is covered by the orphaned-tracker recovery unit test in
  `apps/mobile/src/__tests__/end-to-end.test.ts` and by the manual step in
  [`smoke-test.md`](./smoke-test.md). Do not treat the unit test as proof that background recovery
  works on a device.
- **CP-6 asserts the History row, not the Turf map.** The flow checks the deleted row is gone. It
  does not check that the turf cells are released; that is covered by Territory unit tests only.
- **CP-3 uses simulated movement.** It proves the background task path on the simulator, not iOS
  behaviour with the screen locked on a real device. Use the smoke test for that.
- **CP-9 export is unit-tested, not in Maestro.** Saving a recording to Apple Health is checked in
  `apps/mobile/src/__tests__/apple-health.test.ts` and was verified once on the Simulator (the
  `hs_links` export row, and the next import skipping our own workout). Apple Watch workouts can
  only be tested on a device.
- Android has no Maestro run today.

## 4. Adding a flow

1. Add `apps/mobile/e2e/NN-name.yaml` with `tags: [...]` from the allowed set. Prefer `id:`
   selectors; add the `testID` in `apps/mobile/src/` first.
2. Add it to `flowsOrder` in `apps/mobile/e2e/config.yaml` (keep `08-sign-out` last).
3. Map it to a critical path in section 1 (or add a CP row), then run `pnpm run e2e:audit`.
4. No commented-out steps: delete them or fix the flow.
