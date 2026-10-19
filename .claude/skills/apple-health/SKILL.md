---
name: apple-health
description:
  CityTurfer's Apple Health (HealthKit) integration — the Health Sync context that imports walks,
  hikes, runs and rides with their routes as Activities (so they claim turf) and saves recordings to
  Health as workouts with routes. Covers the @kingstinct/react-native-healthkit adapter, the
  HealthKit permission sheet (incl. iOS 26's "how much history" step), anchors and links that stop
  duplicates, privacy rules, free-Apple-ID signing, and how to test on the Simulator (seed tool,
  Maestro flow 11) and on a real iPhone with Apple Watch data. Use for anything touching
  apps/mobile/src/contexts/health-sync/, the Apple Health card, the healthkit plugin in app.json, or
  "import from Health / save to Health / Apple Watch workouts" requests.
---

> **DDD mapping** (see `docs/decisions/apple-health-2026-10-18.md`): bounded context **Health Sync**
> (`apps/mobile/src/contexts/health-sync/`) — an anti-corruption layer between Apple Health and the
> Activity Log. "Workout" is Apple's word and never leaves this context; everywhere else it is an
> **Activity** with a **Track**. Tables `hs_state`, `hs_links` (migration 6). Activity Log is
> reached only through its public API, adapted in `apps/mobile/src/wiring.ts` (`ActivityGateway`
> port).

# Apple Health

## What it does

- **Import** (`ImportHealthWorkouts`): walking + hiking → `walk`, running → `run`, cycling →
  `cycle`. Each workout's route becomes Track Points (`trackPointsFromRoute`: invalid points and
  accuracy > 50 m dropped, time-ordered, split into Segments at gaps), then
  `activityLog.importActivity` with id `hk-<Health UUID>`. Activity Log emits `ActivityRecorded`
  (origin `import`) and Territory claims turf as for any recording.
- **Export** (`ExportActivityToHealth`, on `ActivityRecorded` with origin `recording`): saves a
  workout (type, start, end, distance) with metadata `CityTurferActivityId`, then its route.
- Runs: when the app becomes active and on foreground launch (`c.syncHealth()`), and from the
  Settings card's "Import now". Never headless: HealthKit data is locked while the phone is.

## Rules that keep it correct

- **No duplicates, ever.** `hs_links` maps Activity ↔ Health UUID and outlives deleted Activities: a
  deleted import is never imported again, a recording is never exported twice. Never add a foreign
  key to `log_activities`.
- **Never import our own workouts**: recognised by the `CityTurferActivityId` metadata key, not by
  bundle id (dev tools write sample workouts from this app and those must import).
- **Never export imports** (origin `import`) or anything from before connecting
  (`e.at < connectedAt`).
- **Export never throws.** The outbox is strict FIFO; a throwing handler would hold up turf for
  every later event. Failures go to diagnostics (`health.export-failed`, `health.route-not-saved`)
  and are not retried (a retry could save the workout twice).
- **Anchor after every page** (`IMPORT_PAGE_SIZE` = 25), so a first import of years of workouts
  resumes after a crash or kill.
- Workouts without a usable route (treadmill, indoor, routes not shared) are counted as
  `withoutRoute` and skipped: turf needs a track.

## HealthKit facts that shape the UX

- **Read permission is invisible**: HealthKit never says whether reading was allowed. "0 workouts"
  can mean "denied". The card shows a hint pointing to Health › Sharing › Apps › CityTurfer.
- **iOS 26 asks how much history** to share ("Past 30 Days" vs "All Recorded Data"). The card tells
  people to pick All Recorded Data; the Maestro flow does.
- The sheet appears once. Later changes happen only in the Health app.
- Permission types: read Workouts + Workout Routes; write those plus Walking + Running Distance and
  Cycling Distance.

## Library and native setup

- `@kingstinct/react-native-healthkit` 16.x (Nitro modules; `react-native-nitro-modules` is a peer).
  Plugin in `apps/mobile/app.json` with our own usage strings and `background: false`.
- `apps/mobile/react-native.config.js` keeps both packages out of the Android build.
- The adapter `healthkit-health-store.ts` loads the module with a guarded `require` on iOS only;
  `available` is false on Android and in binaries without HealthKit. Nothing outside that file
  imports the library (except the dev seed tool).
- Known library limits: `saveWorkoutSample` uses the iOS 17-deprecated `HKWorkout` initialiser, and
  the route is saved in a second call (`routeSaved` records whether it worked).
- Adding or changing the plugin is a **native change**: new runtime fingerprint, reinstall, no OTA.
- **Free Apple ID**: HealthKit works with a personal team. If Xcode says the profile doesn't support
  HealthKit, open Signing & Capabilities once and let it re-sign. The profile still expires after 7
  days.

## Privacy

- Health data stays on the phone. No analytics, no logging of coordinates or workout details
  (diagnostics carry codes only). Never send Health data to the OSM router or any server.
- App Store (later): describe the HealthKit use in the listing, keep health data out of iCloud
  (CloudKit / iCloud Drive), privacy policy required.

## Testing

- Unit + integration: `apps/mobile/src/contexts/health-sync/__tests__/`,
  `apps/mobile/src/__tests__/apple-health.test.ts` with `FakeHealthStore` (test-support). Real SQL,
  real wiring.
- Simulator: dev tools on the Info screen → "Add sample workouts to Apple Health" writes three
  workouts with routes around the simulated location. Maestro:
  `apps/mobile/e2e/11-apple-health.yaml` (iOS only). Check the database:
  `sqlite3 -readonly "$(xcrun simctl get_app_container booted com.turftrack.poc data)"/Documents/SQLite/turftrack-<uid>.db 'SELECT * FROM hs_links'`.
- Real iPhone (founder): Apple Watch workouts and routes cannot be simulated. Before claiming
  anything about Watch imports, test on the device (`docs/operations/apple-health.md`).
