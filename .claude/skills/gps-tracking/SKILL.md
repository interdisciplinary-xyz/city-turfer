---
name: gps-tracking
description: >-
  Use for "tracking stops when the screen is off", missing points, GPS jumps, drift while standing
  still, battery drain, location permissions, or any work in apps/mobile/src/contexts/recording/:
  background task, iOS live updates, Fix Filter, auto-pause, kill recovery.
---

> **Where the code lives**, all under `apps/mobile/src/contexts/recording/`:
>
> - domain: Fix Filter → `domain/fix-filter.ts` (`judgeFix`); session lifecycle, segments and
>   auto-pause → the `RecordingSession` aggregate in `domain/recording-session.ts`; profiles →
>   `domain/tracking-profile.ts` (`trackingProfileFor`); `Fix` → `domain/fix.ts`
> - application: `application/use-cases.ts` (`StartRecording`, `PauseRecording`, `ResumeRecording`,
>   `IngestFixes`, `FinishRecording`, `DiscardRecording`, `RecoverSession`, …), all serialised by
>   `application/command-executor.ts` (`SerialCommandExecutor`)
> - infrastructure: the task → `infrastructure/background-task.ts` (thin, Expo-bound) →
>   `infrastructure/location-batch-handler.ts` (`createLocationBatchHandler`, Expo-free and tested);
>   `expo-location` ACL → `infrastructure/expo-location-tracker.ts` (`toFix`/`toFixOn`,
>   `ExpoLocationTracker`, `ExpoPermissionGateway`); iOS native session →
>   `infrastructure/background-activity-session.ts` over `apps/mobile/modules/background-session`;
>   live UI state → `infrastructure/live-session-store.ts`
> - thresholds shared with Activity Log: `packages/core/src/constants/tracking.ts`
>   (`MOVING_SPEED_MPS`, `ELEV_HYSTERESIS_M`, `MAX_FIX_GAP_MS`)

# GPS tracking

The single most important property of the app: **a recorded route survives the screen turning off,
the app being backgrounded, and the JS context being killed.** Design every change around that.

## Architecture

```
stream 1: expo-location task (LOCATION_TASK)        ─┐
stream 2: iOS 17+ CLLocationUpdate.liveUpdates       ─┤  background-task.ts (top level)
          (backgroundActivitySession, native module) ─┘          │ handleBatch(source, locations)
                                                                 ▼
                        location-batch-handler.ts: getContainer() (timeout) → toFix → hand-off in order
                                                                 ▼
                        IngestFixes (inside the SerialCommandExecutor queue, shared with the UI's commands)
                          load active RecordingSession → session.ingestWithReport(fixes) (Fix Filter + auto-pause)
                          → repository.save(session, points): state + points + events, ONE transaction
                                                                 ▼
                        SQLite rec_sessions / rec_track_points  ◀── source of truth
                                                                 │ notifier.publish(snapshot)
                        LiveSessionStore (useSyncExternalStore) ── live map + stats
```

- `TaskManager.defineTask(LOCATION_TASK, …)` must be **evaluated at module top level, at app
  start**: `apps/mobile/index.ts` imports `background-task.ts` before `expo-router/entry`. If it's
  defined inside a component or effect, Android headless restarts and iOS relaunches deliver
  locations to a task that doesn't exist.
- Two streams feed the same handler. On iOS 17+ the live-updates stream inside a
  `CLBackgroundActivitySession` is the primary one; the expo-location task is the safety net (and
  the only stream on Android or builds without the native module). Duplicates across the streams are
  dropped by the Fix Filter as out-of-order.
- `createLocationBatchHandler` (keep the logic here, not in `background-task.ts`, so it stays
  testable headless):
  1. gets the per-user container. `null` means nobody is signed in: stop tracking (an orphaned
     tracker drains the battery). A rejection or a timeout (15 s) means "can't tell": skip only this
     batch, keep the tracker and session running, and log the error with the next batch;
  2. hands the batch to `IngestFixes` **in delivery order** (a batch submitted out of order would
     have its fixes dropped as out-of-order);
  3. never throws, and logs counts and timings only, never coordinates, to `sys_diagnostics`
     (`apps/mobile/src/platform/diagnostics.ts`).
- `IngestFixes` reads the active session **from SQLite** (in a headless relaunch memory is empty).
  With no active session it stops the orphaned tracker itself, inside the queue, so it can't race a
  new Start. After saving it calls `tracker.reacquire()` to keep the iOS session alive.
- Every Recording command (Start, IngestFixes, Pause, Resume, Finish, Discard, Recover) goes through
  the one `SerialCommandExecutor` of the container. Never `run` a command from inside another one.
- The UI does not own the data: it reads `LiveSessionStore`, which the use cases publish to.

## Starting updates

`ExpoLocationTracker.start(profile)` (shape, not verbatim):

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
    // Android: required for background; title per type, copy and colour from the brand
    notificationTitle: `Recording your ${label}`,
    notificationBody: `${NAME} is claiming your streets. Tap to open.`,
    notificationColor: ACCENT,
    killServiceOnDestroy: false,
  },
});
await backgroundActivitySession.start(); // iOS: must be acquired in the foreground (the Start tap)
```

If updates are already running, `start` stops them first and restarts with the new profile (no
double start). Stop with `tracker.stop()` only when the session ends. **Pausing does not stop
updates**: fixes keep arriving, a manual Resume starts a new `segment`, and paused time is excluded
from moving time.

Per-type values in `apps/mobile/src/contexts/recording/domain/tracking-profile.ts` (the moving speed
comes from `MOVING_SPEED_MPS` in core). Keep the filter thresholds in sync with
`apps/mobile/tools/lib/geo.mjs` `PROFILES`, so the oracle and the app agree:

| type  | distanceIntervalM | timeIntervalMs | maxAccuracyM | maxSpeed m/s | minStep m | autoPause below m/s for s |
| ----- | ----------------- | -------------- | ------------ | ------------ | --------- | ------------------------- |
| walk  | 3                 | 2000           | 25           | 4            | 3         | 0.5 for 15                |
| run   | 4                 | 1000           | 25           | 8            | 4         | 1.0 for 10                |
| cycle | 6                 | 1000           | 30           | 25           | 6         | 1.5 for 8                 |

## Permission flow

What `StartRecording` does today:

1. `ExpoPermissionGateway.ensureForeground()`: location services off → `location-services-off`;
   otherwise ask for foreground permission if it isn't granted → `permission-denied` on refusal.
2. `requestBackground()`, whose result **never blocks** the start:
   - **iOS** asks for "Always". iOS may grant "While Using" first and offer "Always" later; "While
     Using" plus the background indicator and the background activity session is workable, because
     iOS keeps delivering updates to an app that started them in the foreground.
   - **Android** does not ask: the foreground service covers background recording, and the request
     would bounce the user to Settings (Android 11+ has no dialog for "Allow all the time").

Planned, not built (keep when you touch the permission UX):

- An in-app explanation screen before the first system dialog.
- On denial, a link to Settings (`Linking.openSettings()`).
- Android: suggest exempting the app from battery optimisation (dontkillmyapp.com guidance for
  Xiaomi, Huawei, Samsung). OEM killers are the main cause of "the route stops after 10 minutes".

## Filtering (`domain/fix-filter.ts`, pure, unit-tested)

`judgeFix` returns `accept`, `reject` (`inaccurate` | `out-of-order` | `teleport`) or `jitter`. In
order:

1. Reject when `accuracy > profile.maxAccuracyM`. Expect a few bad fixes while GPS warms up; the
   Record screen shows "Waiting for GPS…" until the first accurate fix.
2. Reject when the timestamp is ≤ the last fix seen (batches overlap, two streams, out of order).
3. Reject when the speed implied from the reference point exceeds `maxSpeedMps` (teleport spikes).
4. Jitter when the distance from the reference is < `minStepM` and < `JITTER_MAX_DT_S` (10 s) have
   passed: not stored, but it still updates "last seen" so auto-pause works.

Speed: device (Doppler) speed is used only while fixes flow (previous fix ≤ `DOPPLER_MAX_AGE_S`, 5
s, old); otherwise the position delta. A jitter fix without fresh Doppler speed reports 0 m/s.

The aggregate adds, in `ingestWithReport`:

- **Gaps**: no fix for more than `MAX_FIX_GAP_MS` (45 s) starts a new segment; never draw, measure
  or claim across it.
- **Auto-pause**: speed below `movingSpeedMps` for `autoPauseAfterS` → `autoPaused`; the first fix
  above the threshold resumes (`SessionResumed` with `auto: true`). Always on, for every type (a
  user setting is planned, not built).

`ExpoLocationTracker`'s ACL (`toFixOn`) maps Android's "0 = unknown" speed and altitude to `null`,
and iOS's negative speed to `null`.

## Recovery

`RecoverSession` runs on app start, inside the queue:

- Active session in the DB and updates not running (the OS killed the service) → restart tracking
  silently with the session's profile (`resumed-tracking`) and publish the snapshot. If the restart
  fails, the session stays (`tracking-continues`). Never silently discard a session.
- Updates running but no active session → stop them (`stopped-orphan-tracker`).

A "Resume recording?" prompt instead of the silent restart is a product decision, not built.

## Battery

- `BestForNavigation` is right while recording. **Never** run background updates outside an active
  session (the batch handler and `IngestFixes` both stop orphaned trackers).
- Planned, not built: `watchPositionAsync` with `Accuracy.High` for a pre-recording position
  (removed on blur), and `expo-keep-awake` (installed, unused) only while the Record screen is
  visible and the user enabled "keep screen on".

## Verifying a tracking change

Unit tests cover the filter and the aggregate (`domain/__tests__/`), the command queue, the ACL
(`infrastructure/__tests__/to-fix.test.ts`), the repository and the batch handler
(`apps/mobile/src/__tests__/headless-resilience.test.ts`). They do **not** prove the OS wiring.
After any change to `background-task.ts`, `location-batch-handler.ts`,
`background-activity-session.ts` or the native module, `expo-location-tracker.ts`,
`command-executor.ts`, `recording-session.ts` or the permission flow, run a dev build and replay a
fixture (`mobile-testing` skill): start recording, background the app, wait at least 60 s,
foreground it, and check that the route has no gap.
