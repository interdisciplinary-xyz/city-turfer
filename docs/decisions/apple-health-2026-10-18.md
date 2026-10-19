---
status: canonical
verified: 2026-10-18
owner: founder
scope:
  [apps/mobile/src/contexts/health-sync, apps/mobile/app.json, apps/mobile/react-native.config.js]
summary:
  v0.4.0 integrates Apple Health — a Health Sync context imports walks, hikes, runs and rides with
  routes (full history) as Activities that claim turf, and saves recordings to Health with routes
---

# Apple Health integration (v0.4.0)

## Decisions (founder, 2026-10-18)

- **Both directions.** Import from Apple Health, and save CityTurfer recordings to it automatically
  (a switch in Settings, on by default).
- **Full history** on the first import: every walk, hike, run and ride with a route, Apple Watch
  workouts included, so turf lights up from day one.
- **Library:** `@kingstinct/react-native-healthkit` 16.x (Nitro modules), wrapped behind our own
  port. Considered and rejected: our own Swift module (more control, modern `HKWorkoutBuilder`, one
  call for workout + route) — chosen against for speed; `react-native-health` (old bridge, last
  release 2024).
- **Free Apple ID is enough:** Apple's capability table lists HealthKit for the free tier.

## Design

A new bounded context, **Health Sync** (`apps/mobile/src/contexts/health-sync/`), is the
anti-corruption layer between Apple Health and the Activity Log:

```
Apple Health ──HealthStore port──▶ Health Sync ──ActivityGateway──▶ Activity Log ──ActivityRecorded──▶ Territory
                                        ▲                                   │
                                        └──── ActivityRecorded (recording) ─┘  (export)
```

- **Import:** anchored query, 25 workouts per page, anchor saved after each page. Workout type →
  Activity Type (walking/hiking → walk, running → run, cycling → cycle). Route → Track Points (bad
  and > 50 m points dropped, Segments at gaps). Activity id `hk-<Health UUID>` through
  `ImportActivity`, which now marks `ActivityRecorded` with `origin: 'import'`.
- **Export:** handler on `ActivityRecorded` with origin `recording`, after Territory's claim. Saves
  the workout with metadata `CityTurferActivityId` and its route. Never throws (strict-FIFO outbox);
  failures go to diagnostics and are not retried.
- **Memory:** `hs_links` (Activity ↔ Health UUID, direction) without a foreign key, so deleted
  imports stay deleted and nothing is exported twice; `hs_state` (connection, switches, anchor, last
  import). Migration 6.
- **When:** foreground launch and whenever the app becomes active, plus "Import now". Never
  headless.
- **UI:** an Apple Health card on the Info screen (connect, two switches, last import, import now,
  disconnect); "From Apple Health" on imported activities. Hidden on Android.

## Consequences

- **Native change.** New runtime fingerprints (iOS and Android: the plugin is part of the shared app
  config). The iPhone needs a reinstall; Android needs a new APK before the next OTA.
  `react-native.config.js` keeps the HealthKit and Nitro native code out of Android.
- Workouts without a route (treadmill, indoor) are skipped: turf needs a track.
- HealthKit hides read denial. "0 workouts" can mean "not allowed"; the card says where to check.
- iOS 26 asks how much history to share; only "All Recorded Data" gives a full import.
- Known library limits: deprecated `HKWorkout` initialiser on save; the route is a second call.
- Deleting a workout in Apple Health does not delete the CityTurfer Activity (it is the user's turf
  history now).

## Open

- Health data and iCloud: the app database is in the device backup. Fine for personal sideloading;
  revisit before the App Store (guideline 5.1.3).
- Android: Health Connect, the same context with a second adapter.
- Background delivery (import without opening the app): possible later with HealthKit observer
  queries; off for now (`background: false`).
