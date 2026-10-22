---
name: mobile-testing
description: >-
  Use when writing tests, verifying a feature end to end, reproducing a tracking bug, or asked "does
  it work?". Jest on real SQL, gen-route fixtures, route-stats oracle, sim-location.sh replay,
  background checks, Maestro E2E.
---

# Testing CityTurfer

Three layers, and each one catches things the others can't.

## 1. Unit (Jest, fast, every change)

- Pure domain and application code lives in `packages/core` (shared-kernel, identity, activity-log,
  territory, achievements): `pnpm --filter @cityturfer/core test:unit`.
- Mobile-side units (`apps/mobile/src/**`, e.g. `contexts/recording/domain/fix-filter.ts`) run with
  `pnpm -C apps/mobile exec jest`; the Jest config is the `jest` key in each `package.json` (node
  environment, `babel-preset-expo`, `@/` mapper, `watchman: false`), no `jest.config.*`.
  `pnpm -C apps/mobile test` also runs depcruise; `test:tools` runs the `node --test` suites in
  `tools/__tests__/` (e2e audit, turf parity).
- Repositories and the outbox: test against real SQLite via
  `apps/mobile/src/test-support/node-database.ts` (`openNodeDatabase()`, a `Database` adapter over
  `better-sqlite3`). Don't mock the queries.
- **Integration tests use real wiring:** `migrate(db)` then `wire()` from
  `apps/mobile/src/wiring.ts` with fakes for the device ports. Models in
  `apps/mobile/src/__tests__/`: `end-to-end`, `headless-resilience`, `recording-concurrency`,
  `outbox-and-retention`, `apple-health`, `cloud-backup`. Drive the recording path by calling
  `c.recording.ingestFixes.execute(fixes)` with batches built by `loadFixes('walk-2k.gpx')`
  (`test-support/fixtures.ts`). Expected numbers come from `oracleStats(fixture)`
  (`test-support/oracle.ts`, wraps the `route-stats` oracle).
- No `expo-task-manager` mock is used: the task is a thin adapter over `IngestFixes`. When a test
  needs a native module, mock it in that file (there is no `jest.setup.ts`) and keep it minimal; see
  `contexts/recording/infrastructure/__tests__/to-fix.test.ts`:
  ```ts
  jest.mock('expo-location', () => ({}));
  jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
  jest.mock('../background-activity-session', () => ({ backgroundActivitySession: {} }));
  ```
  `jest.mock` factories may only reference variables prefixed `mock`.

### Fixtures

```bash
node apps/mobile/tools/gen-route.mjs --type walk  --km 2  --interval 2 > apps/mobile/tools/fixtures/walk-2k.gpx
node apps/mobile/tools/gen-route.mjs --type run   --km 5  --outliers 4 --pause 90 > apps/mobile/tools/fixtures/run-5k-outliers-pause.gpx
node apps/mobile/tools/gen-route.mjs --type cycle --km 20 --interval 2 --climb 40 > apps/mobile/tools/fixtures/cycle-20k.gpx
node apps/mobile/tools/gen-route.mjs --type run --km 5 --format json > apps/mobile/tools/fixtures/run-5k.json   # (illustrative, not committed) includes truth.{distanceM,movingS,elevGainM}
```

For turf work, generate months of overlapping history (deterministic, gitignored, regenerate instead
of committing):

```bash
node apps/mobile/tools/gen-history.mjs --days 120 --out apps/mobile/tools/fixtures/history          # ~54 activities, favourite routes repeated
node apps/mobile/tools/gen-history.mjs --days 365 --per-week 5 --out /tmp/year          # performance budget (Q4)
node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html     # visual reference for the Turf Map
```

In a dev build, the Info screen's "Seed demo history" button loads the built-in demo history
(`apps/mobile/src/dev/demo-history.ts`); "Add sample workouts to Apple Health" uses
`dev/health-seed.ts`. There is no GPX import UI for fixture files.

Generation is seeded (`--seed`), so fixtures are reproducible. Commit single-route fixtures (`.gpx`
directly in `apps/mobile/tools/fixtures/`, un-ignored in `.gitignore`); never `fixtures/history/`.
Assert the app's metrics against `node apps/mobile/tools/route-stats.mjs <gpx> --json` (oracle) and,
for JSON fixtures, against `truth`. Distance should land within ±3% of truth.

## 2. Simulated movement on a dev build (any tracking change)

```bash
pnpm -C apps/mobile exec expo run:ios                                        # or run:android
apps/mobile/tools/sim-location.sh ios apps/mobile/tools/fixtures/run-5k-outliers-pause.gpx 3   # 3 m/s
apps/mobile/tools/sim-location.sh android apps/mobile/tools/fixtures/walk-2k.gpx 1             # 1 s per point
apps/mobile/tools/sim-location.sh ios --clear
```

iOS Simulator also has built-in presets under Features → Location → City Run / City Bicycle Ride /
Freeway Drive.

**Background check script** (do this for any change to `apps/mobile/src/contexts/recording/`):

1. Grant location "Always" (or "Allow all the time").
2. Start recording, then start the replay.
3. Background the app (iOS: Cmd+Shift+H, or `xcrun simctl launch booted com.apple.Preferences` to
   bring another app forward; Android: `adb shell input keyevent KEYCODE_HOME`) and wait ≥ 60 s.
4. Lock the screen (Android: `adb shell input keyevent KEYCODE_POWER`) and wait ≥ 60 s.
5. Foreground the app. The live polyline must have no straight-line gap over the background period,
   and the point count must keep growing.
6. Android only: `adb shell am kill com.turftrack.poc` while recording → relaunch → the "Resume
   recording?" flow must appear, with no points lost before the kill.

Report what you actually observed. If no simulator or emulator is available, say the change is
unverified on-device.

## 3. E2E (Maestro, before a release)

**Flows:** `apps/mobile/e2e/`, run in the order of `flowsOrder` in `apps/mobile/e2e/config.yaml`.
The source of truth is that file and `docs/quality/e2e.md` (critical paths CP-n). `08-sign-out`
always runs last. Shared steps live in `apps/mobile/e2e/subflows/` (`launch`, `sign-in`,
`allow-location`, `finish`, `back`; `travel-*.yaml` are generated from GPX by
`apps/mobile/tools/e2e/gpx-to-travel.mjs`).

**Run:**

- `apps/mobile/e2e/run.sh` runs all flows; `apps/mobile/e2e/run.sh 13-record-turf` runs one.
- Pass `DEVICE=<udid>` when more than one simulator or emulator is up. Maestro lives at
  `~/.maestro/maestro/bin/maestro` if it isn't on PATH.
- A full run wipes the app's SQLite and the simulator keychain first; a single flow keeps the state.
- With Metro on 8081, flows open the dev-client link, so the JS comes from **whatever checkout Metro
  serves**. Check with `lsof -nP -iTCP:8081 -sTCP:LISTEN` and that process's `cwd`.
- **Android emulator:**
  `maestro --device emulator-5554 test apps/mobile/e2e --config apps/mobile/e2e/config.yaml -e DEV_URL="exp+turftrack://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"`,
  after `adb reverse tcp:8081 tcp:8081` and granting location and notification permissions
  (`docs/operations/android-release.md`).

**Write:**

- Select by `id:` (`testID`). Every id a flow uses must exist in `apps/mobile/src`, and tags must
  come from `ALLOWED_TAGS` in `apps/mobile/tools/e2e/audit.mjs`. Run
  `pnpm -C apps/mobile run e2e:audit` (also part of `ci:quality`).
- Register a new flow in `flowsOrder` and add its critical path to `docs/quality/e2e.md`.
- Toggles: `assertVisible: { id: 'record-turf', checked: true }` reads the switch's
  `accessibilityState`.

**Pitfalls (each cost a run):**

- **iOS exposes accessibility labels, not text.** A chip with `accessibilityLabel="Show Kraków"`
  that displays "⌂ Kraków" is found by "Show Kraków", not by its text. Assert on ids or labels.
- **The Expo dev menu can open over the app** on a dev build's launch (always on Android's first
  launch; sometimes on iOS). It swallows taps. `subflows/launch.yaml` closes it: Back on Android,
  "Close" on iOS. Use that subflow.
- **Settings in secure storage (Keychain) survive reinstalls and single-flow runs.** A flow that
  changes one must normalise it first (`runFlow: when: … commands: …`) and leave the default at the
  end.
- **Host load:** an overloaded Mac or emulator shows up as `eraseText` or driver start-up timeouts,
  apps taking more than 60 s to open, and simulated GPS (`travel`) that never reaches the app.
  - Check `uptime`. Cold-boot the emulator (`-no-snapshot-load`), and rerun on an idle machine
    before calling it an app bug.
  - Another Claude session building or installing on the same Mac is enough to cause it.
- **Stopping a run mid-flow** fails the current flow. Ignore that result.

Example (shape of a flow):

```yaml
# What the flow proves, and the state it leaves behind.
appId: com.turftrack.poc
tags: [recording]
---
- runFlow: subflows/launch.yaml
- tapOn: { id: 'tab-record' }
- tapOn: { id: 'activity-type-run' }
- tapOn: { id: 'record-start' }
- runFlow: subflows/allow-location.yaml
- extendedWaitUntil: { visible: { id: 'stat-distance' }, timeout: 15000 }
- runFlow: subflows/travel-run.yaml
- runFlow: subflows/finish.yaml
- extendedWaitUntil: { visible: { id: 'turf-gained' }, timeout: 30000 }
```

## Real devices

For recording gaps in a pulled database, run `node apps/mobile/tools/diagnose-recording.mjs <db>`
(timeline without coordinates) or `apps/mobile/tools/device-diagnose.sh`. CP-4 (kill recovery) has
no Maestro flow, so the Android kill step above is its only on-device check; CP-3 is
`03-background-recording` (simulator only).

Simulators don't reproduce GPS warm-up, urban-canyon multipath, OEM battery killers or tunnels.
Before calling tracking "done", record one real walk on a physical device, export the GPX, and
inspect it with `node apps/mobile/tools/route-stats.mjs export.gpx`.
