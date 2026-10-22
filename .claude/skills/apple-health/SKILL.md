---
name: apple-health
description: >-
  "Import from Health", "save to Health", Apple Watch workouts, duplicate or missing imports,
  HealthKit permissions, the healthkit plugin in app.json. Health Sync
  (apps/mobile/src/contexts/health-sync/): adapter, links and retries, privacy, Simulator seeding,
  Maestro flow 11, device tests.
---

> **DDD mapping** (see `docs/decisions/apple-health-2026-10-18.md`): bounded context **Health Sync**
> (`apps/mobile/src/contexts/health-sync/`, app only: not in `@cityturfer/core`) — an
> anti-corruption layer between Apple Health and the Activity Log. "Workout" is Apple's word and
> never leaves this context; everywhere else it is an **Activity** with a **Track**. Migration 6
> creates `hs_state`, `hs_links`, `hs_pending_imports` and `hs_pending_exports`. Activity Log is
> reached only through the `ActivityGateway` port (`importTrack`, `detailOf`, `overlapping`),
> adapted to Activity Log's public API in `apps/mobile/src/wiring.ts`.

# Apple Health

## What it does

- **Import** (`ImportHealthWorkouts`): walking + hiking → `walk`, running → `run`, cycling →
  `cycle`. Each workout's route becomes Track Points (`trackPointsFromRoute`: invalid points and
  accuracy > 50 m dropped, time-ordered, split into Segments at gaps), then
  `ActivityGateway.importTrack` (→ Activity Log's `importActivity`) with id `hk-<Health UUID>`.
  Activity Log emits `ActivityRecorded` (origin `import`) and Territory claims turf as for any
  recording.
- **Export**: `ExportActivityToHealth` (on `ActivityRecorded` with origin `recording`) only queues
  the Activity in `hs_pending_exports` and, in the foreground, flushes at once. `FlushHealthExports`
  does the writing: a workout (type, start, end, distance) with metadata `CityTurferActivityId`,
  then its route. A recording finished while headless waits in the queue until the app is next
  opened.
- **When**: `c.syncHealth()` (flush exports, then import) on foreground launch and whenever the app
  becomes active, reading from the saved anchor. The Apple Health card on the **Info screen** has
  "Import now", which scans the whole history (`full: true`). Never headless: HealthKit data is
  locked while the phone is.

## Rules that keep it correct

- **No duplicates, ever.**
  - `hs_links` maps Activity ↔ Health UUID and outlives deleted Activities: a deleted import is
    never imported again, a recording is never exported twice. Never add a foreign key to
    `log_activities`.
  - A workout overlapping an Activity of the same type already in CityTurfer by ≥ 50 %
    (`isSameOuting`, `SAME_OUTING_OVERLAP`) counts as `duplicates` and is not imported (why Maestro
    reruns say "already in CityTurfer").
- **Never import our own workouts**: recognised by the `CityTurferActivityId` metadata key, not by
  bundle id (dev tools write sample workouts from this app and those must import).
- **Never export imports** (origin `import`) or anything from before connecting
  (`e.at < connectedAt`).
- **Export never throws.** The outbox is strict FIFO; a throwing handler would hold up turf for
  every later event. Failures go to diagnostics as codes (`health.export-failed`,
  `health.route-not-saved`); the export stays queued and is retried up to `MAX_EXPORT_ATTEMPTS` (5).
  Before every save, `findSavedWorkout(activityId)` asks Health for our metadata key, so a retry or
  a crash between save and link never writes a second workout.
- **Anchor after every page** (`IMPORT_PAGE_SIZE` = 25), so a first import of years of workouts
  resumes after a crash or kill.
- **Late routes**: workouts without a readable route (Apple Watch still syncing) or whose import
  failed go to `hs_pending_imports` and are retried on later syncs for `IMPORT_RETRY_WINDOW_MS` (3
  days after they end); they count as `withoutRoute` (or `skipped`). Older ones, and truly
  route-less workouts (treadmill, indoor, routes not shared), are dropped: turf needs a track.
- **The `hk-` id prefix is published language**: cloud backup
  (`contexts/cloud-backup/domain/backup-policy.ts`) uses it to keep Apple Health imports off the
  server unless the user opted in. Never change it.

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
- `apps/mobile/react-native.config.js` keeps three packages out of the Android build: the library,
  its `@react-native-healthkit/core` and `react-native-nitro-modules`.
- The adapter `healthkit-health-store.ts` loads the module with a guarded `require` on iOS only;
  `available` is false on Android and in binaries without HealthKit. Nothing outside that file
  imports the library (except the dev seed tool `apps/mobile/src/dev/health-seed.ts`).
- Known library limits: `saveWorkoutSample` uses the iOS 17-deprecated `HKWorkout` initialiser, and
  the route is saved in a second call (`routeSaved` records whether it worked).
- Adding or changing the plugin is a **native change**: new runtime fingerprints on both platforms
  (the plugin is in the shared app config), reinstall, no OTA. Check with
  `pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios|android | jq -r .hash`.
- **Free Apple ID**: HealthKit works with a personal team. If Xcode says the profile doesn't support
  HealthKit, open Signing & Capabilities once and let it re-sign. The profile still expires after 7
  days.

## Privacy

- No analytics, no logging of coordinates or workout details (diagnostics carry codes only). Never
  send Health data to the OSM router.
- Health data reaches our API only as imported Activities, and only when the user turns on "Include
  Apple Health workouts" in cloud backup (server consent `apple-health-in-cloud-sync`). Everything
  else stays on the phone.
- App Store (later): describe the HealthKit use in the listing, keep health data out of iCloud
  (CloudKit / iCloud Drive), privacy policy required.

## Testing

- Unit + integration: `apps/mobile/src/contexts/health-sync/__tests__/`,
  `apps/mobile/src/__tests__/apple-health.test.ts` with `FakeHealthStore`
  (`contexts/health-sync/test-support/`). Real SQL, real wiring.
- Simulator: dev tools on the Info screen → "Add sample workouts to Apple Health" writes three
  workouts (walk, run, ride) with routes around the current simulated location. Maestro:
  `apps/mobile/e2e/11-apple-health.yaml` (iOS only). Check the database:
  `sqlite3 -readonly "$(xcrun simctl get_app_container booted com.turftrack.poc data)"/Documents/SQLite/turftrack-<uid>.db 'SELECT * FROM hs_links'`.
- Real iPhone (founder): Apple Watch workouts, late-syncing routes and real permission history
  cannot be simulated. Before claiming anything about Watch imports, test on the device
  (`docs/operations/apple-health.md`).
