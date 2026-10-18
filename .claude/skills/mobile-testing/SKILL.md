---
name: mobile-testing
description:
  How to test TurfTrack — Jest unit tests for metrics/filter/db, mocking
  expo-location/task-manager/sqlite, GPS fixture generation with apps/mobile/tools/gen-route.mjs,
  the route-stats oracle, replaying routes into the iOS Simulator / Android emulator with
  apps/mobile/tools/sim-location.sh, background-tracking manual checks, and Maestro E2E flows. Use
  when writing tests, verifying a feature end to end, reproducing a tracking bug, or when asked
  "does it work?".
---

# Testing TurfTrack

Three layers, and each one catches things the others can't.

## 1. Unit (Jest, fast, every change)

- `apps/mobile/src/shared-kernel/**` (metrics) and
  `apps/mobile/src/contexts/recording/domain/fix-filter.ts`: pure functions, tested directly against
  fixtures.
- Repositories and the outbox: test against a real SQLite. Jest uses
  `apps/mobile/src/test-support/node-database.ts`, a thin `Database` adapter over `better-sqlite3`
  (dev dependency), so the SQL actually runs. Don't mock the queries themselves.
- When a test needs Expo native modules, mock them in that test file (there is no `jest.setup.ts`;
  see `apps/mobile/src/contexts/recording/infrastructure/__tests__/to-fix.test.ts` and
  `apps/mobile/src/platform/__tests__/expo-database.test.ts`), for example:
  ```ts
  jest.mock('expo-location', () => ({
    Accuracy: { BestForNavigation: 6, High: 4 },
    ActivityType: { Fitness: 3 },
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    hasServicesEnabledAsync: jest.fn(async () => true),
    startLocationUpdatesAsync: jest.fn(),
    stopLocationUpdatesAsync: jest.fn(),
    hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  }));
  jest.mock('expo-task-manager', () => {
    const tasks: Record<string, Function> = {};
    return {
      defineTask: (n: string, fn: Function) => (tasks[n] = fn),
      __tasks: tasks,
      isTaskRegisteredAsync: jest.fn(async () => true),
    };
  });
  ```
  With the `__tasks` handle, a test can invoke the task handler with a batch of locations built from
  a fixture. That's how the task → filter → DB path gets tested without a device.

### Fixtures

```bash
node apps/mobile/tools/gen-route.mjs --type walk  --km 2  --interval 2 > apps/mobile/tools/fixtures/walk-2k.gpx
node apps/mobile/tools/gen-route.mjs --type run   --km 5  --outliers 4 --pause 90 > apps/mobile/tools/fixtures/run-5k-outliers-pause.gpx
node apps/mobile/tools/gen-route.mjs --type cycle --km 20 --interval 2 --climb 40 > apps/mobile/tools/fixtures/cycle-20k.gpx
node apps/mobile/tools/gen-route.mjs --type run --km 5 --format json > apps/mobile/tools/fixtures/run-5k.json   # includes truth.{distanceM,movingS,elevGainM}
```

For turf work, generate months of overlapping history (deterministic, gitignored, regenerate instead
of committing):

```bash
node apps/mobile/tools/gen-history.mjs --days 120 --out apps/mobile/tools/fixtures/history          # ~54 activities, favourite routes repeated
node apps/mobile/tools/gen-history.mjs --days 365 --per-week 5 --out /tmp/year          # performance budget (Q4)
node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html     # visual reference for the Turf Map
```

Load history into a dev build through the dev menu's "Import fixture history"
(`ImportActivityFromGpx`; copy the files to the simulator with `xcrun simctl addmedia` or
`adb push`).

Generation is seeded (`--seed`), so fixtures are reproducible. Commit them. Assert the app's metrics
against `node apps/mobile/tools/route-stats.mjs <gpx> --json` (oracle) and, for JSON fixtures,
against `truth`. Distance should land within ±3% of truth.

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
6. Android only: `adb shell am kill com.turftrack.app` while recording → relaunch → the "Resume
   recording?" flow must appear, with no points lost before the kill.

Report what you actually observed. If no simulator or emulator is available, say the change is
unverified on-device.

## 3. E2E (Maestro, before a release)

Flows live in `apps/mobile/e2e/`, run in the order of `flowsOrder` in `apps/mobile/e2e/config.yaml`
by `apps/mobile/e2e/run.sh`: `01-auth` (wrong password shows `sign-in-error`; `admin@cityturfer.com`
/ `admin1234` reaches the tabs), `02-record-run` (pause, resume, hold to finish → an activity with
turf gained), `03-background-recording`, `04-too-short`, `05-history-detail`, `06-turf-map`,
`07-delete-activity`, `09-me-menu`, `10-dashboard`, and `08-sign-out` last. Shared steps live in
`apps/mobile/e2e/subflows/` (`travel-*.yaml` are generated from GPX by
`apps/mobile/tools/e2e/gpx-to-travel.mjs`). Use `testID` props on every interactive element. Maestro
selects by `id:`.

Example:

```yaml
appId: com.turftrack.app
---
- launchApp: { clearState: true }
- tapOn: { id: 'activity-type-run' }
- tapOn: { id: 'record-start' }
- runFlow: { when: { visible: 'Allow' }, commands: [{ tapOn: 'Allow While Using App' }] }
- runScript: start-sim-route.js # or run apps/mobile/tools/sim-location.sh beforehand
- extendedWaitUntil: { visible: { id: 'stat-distance' }, timeout: 30000 }
- tapOn: { id: 'record-stop' }
- tapOn: { id: 'save-activity' }
- assertVisible: { id: 'history-item-0' }
```

## Real devices

Simulators don't reproduce GPS warm-up, urban-canyon multipath, OEM battery killers or tunnels.
Before calling tracking "done", record one real walk on a physical device, export the GPX, and
inspect it with `node apps/mobile/tools/route-stats.mjs export.gpx`.
