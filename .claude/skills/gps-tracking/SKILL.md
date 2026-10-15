---
name: gps-tracking
description: How TurfTrack records GPS routes reliably with expo-location + expo-task-manager — background task wiring, permission flow (foreground → background, iOS/Android differences), per-activity accuracy settings, Android foreground service, point filtering (accuracy, speed spikes, jitter), auto-pause, crash/kill recovery and battery. Use for any work in src/tracking/, anything involving location permissions, "tracking stops when screen is off", missing points, GPS jumps, drift while standing still, or battery drain.
---

> **DDD mapping** (see `docs/poc-plan.md`): filter → `recording/domain/FixFilter.ts`; auto-pause → `recording/domain/AutoPausePolicy.ts`; profiles → `recording/domain/TrackingProfile.ts`; session lifecycle → `RecordingSession` aggregate + `recording/application/` use cases; `expo-location` calls → `recording/infrastructure/ExpoLocationTracker.ts` (ACL); task → `recording/infrastructure/backgroundTask.ts` calling `IngestFixes`. Paths below written as `src/tracking/…` refer to these.

# GPS tracking

The single most important property of the app: **a recorded route survives the screen turning off, the app being backgrounded, and the JS context being killed.** Design every change around that.

## Architecture

```
expo-location ──(batches)──▶ TaskManager task (src/tracking/task.ts, top-level)
                                 │  filter (src/tracking/filter.ts, pure)
                                 ▼
                           SQLite points table  ◀── source of truth
                                 │
              UI (zustand store) polls/subscribes ── live map + stats
```

- `TaskManager.defineTask(LOCATION_TASK, handler)` must be **evaluated at module top level, at app start**. Import `src/tracking/task.ts` as the first import in `app/_layout.tsx`. If it's defined inside a component or effect, Android headless restarts and iOS relaunches deliver locations to a task that doesn't exist.
- The handler receives `{ data: { locations }, error }`, usually several locations at once. It must:
  1. read the active session (id, type, paused flag) **from SQLite** — not from zustand, because in a headless relaunch the store is empty;
  2. run each location through the filter;
  3. insert accepted points in **one transaction**;
  4. never throw (wrap the handler in try/catch, and record errors in a `tracking_log` table in dev builds).
- The UI reads the latest points from the DB, or through a lightweight event emitter the task also notifies when the app is foregrounded. The UI does not own the data.

## Starting updates

```ts
await Location.startLocationUpdatesAsync(LOCATION_TASK, {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: profile.timeIntervalMs, // Android only
  distanceInterval: profile.distanceIntervalM,
  activityType: Location.ActivityType.Fitness, // iOS
  pausesUpdatesAutomatically: false, // iOS: never let the OS pause a workout
  showsBackgroundLocationIndicator: true, // iOS blue pill
  deferredUpdatesInterval: 0,
  foregroundService: {
    // Android: required for background
    notificationTitle: 'Recording your run',
    notificationBody: 'Tap to return to TurfTrack',
    killServiceOnDestroy: false,
  },
});
```

Per-type defaults for `src/tracking/profiles.ts`. Keep the filter thresholds in sync with `tools/lib/geo.mjs` `PROFILES`, so the oracle and the app agree:

| type  | distanceIntervalM | timeIntervalMs | maxAccuracyM | maxSpeed m/s | minStep m | autoPause below m/s for s |
| ----- | ----------------- | -------------- | ------------ | ------------ | --------- | ------------------------- |
| walk  | 3                 | 2000           | 25           | 4            | 3         | 0.5 for 15                |
| run   | 4                 | 1000           | 25           | 8            | 4         | 1.0 for 10                |
| cycle | 6                 | 1000           | 30           | 25           | 6         | 1.5 for 8                 |

Before starting, call `Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)` so you don't double-start. Stop with `stopLocationUpdatesAsync` only when the session ends. **Pausing does not stop updates**: keep receiving fixes, store them with `segment` incremented on resume, and exclude paused time from moving time.

## Permission flow (do it in this order)

1. Explain the feature on an in-app screen first, before any system dialog.
2. `requestForegroundPermissionsAsync()`. If denied, show how to enable it in Settings (`Linking.openSettings()`).
3. `requestBackgroundPermissionsAsync()`:
   - **Android 11+** shows no dialog; it opens the Settings page, where the user must pick "Allow all the time". Tell them that beforehand.
   - **iOS** may grant "While Using" first and only offer "Always" later. Treat "While Using" plus the background-mode indicator as workable: iOS keeps delivering updates to an app that started them in the foreground.
4. Check `Location.hasServicesEnabledAsync()` (location turned off system-wide).
5. Android: suggest exempting the app from battery optimisation (link to the dontkillmyapp.com guidance for Xiaomi, Huawei and Samsung). OEM killers are the main cause of "the route stops after 10 minutes".

Never block starting a recording on background permission alone. Record with foreground permission and warn that tracking may stop when the screen is off.

## Filtering (src/tracking/filter.ts — pure, unit-tested)

For each incoming fix, in order:

1. Drop fixes where `coords.accuracy > profile.maxAccuracyM`. Expect a few bad fixes at the start while GPS warms up; show "Waiting for GPS…" until the first accurate fix arrives.
2. Drop fixes whose timestamp is ≤ the last accepted one (batches can overlap or arrive out of order).
3. Drop fixes where the implied speed from the last accepted point > `maxSpeed` (teleport spikes).
4. If the distance from the last accepted point < `minStep` and < 10 s have passed, skip the fix (stationary jitter). Still update "last seen" so auto-pause works.
5. Auto-pause: when speed stays below the profile threshold for the configured duration, mark the session auto-paused. Resume on the first fix above the threshold. Auto-pause is a user setting, on by default for run and cycle.

Prefer `coords.speed` when it is ≥ 0 (Doppler-based, better than position deltas); fall back to the position delta otherwise.

## Recovery

- On app start: if the DB has a session with status `recording` and `hasStartedLocationUpdatesAsync` is false (the OS killed the service), show "Resume recording?" and restart updates. Never silently discard the session.
- On app start with updates running but no active session in the DB: stop updates (orphaned task).
- Use `expo-keep-awake` only while the record screen is visible and the user has enabled "keep screen on".

## Battery

- `BestForNavigation` is right while recording. **Never** run background updates outside an active session.
- For a live position before recording starts, use `watchPositionAsync` with `Accuracy.High`, and remove it when the screen blurs.

## Verifying a tracking change

Unit tests cover the filter. They do **not** cover the task wiring. After any change to `task.ts`, `session.ts` or the permission flow, run a dev build and replay a fixture (`mobile-testing` skill): start recording, background the app, wait at least 60 s, foreground it, and check that the route has no gap.
