/**
 * Driving adapter: the OS delivers location batches here — with the app in
 * the foreground, in the background, or after a headless relaunch. Must be
 * imported first (see /index.ts) so the task is defined in the global scope.
 * The batch handling itself lives in location-batch-handler.ts (testable).
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { getContainer } from '@/composition-root';
import { LOCATION_TASK } from '@/constants/location';

import { backgroundActivitySession } from './background-activity-session';
import { toFix } from './expo-location-tracker';
import { createLocationBatchHandler } from './location-batch-handler';

/** Well below the time iOS grants a background wake-up; a healthy batch commits in milliseconds. */
const INGEST_TIMEOUT_MS = 15_000;

const handleBatch = createLocationBatchHandler<Location.LocationObject>({
  getContainer,
  stopTracking: async () => {
    await backgroundActivitySession.stop();
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
  },
  toFix,
  describe: (source, locations) => {
    const ts = locations.map((l) => l.timestamp);
    return {
      source,
      appState: AppState.currentState,
      received: locations.length,
      firstFixAgoS: ts.length ? Math.round((Date.now() - Math.min(...ts)) / 1000) : null,
      maxAccuracy: Math.max(0, ...locations.map((l) => l.coords.accuracy ?? 0)),
    };
  },
  timeoutMs: INGEST_TIMEOUT_MS,
  warn: (message, e) => {
    if (__DEV__) console.warn(message, e);
  },
});

// Stream 1 (safety net): expo-location's background task (CLLocationManager + significant-change wake-ups).
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.warn('[location-task]', error.message);
    void getContainer()
      .then((c) => c?.diagnostics.log('task-error', { code: error.code, message: error.message }))
      .catch(() => undefined);
    return;
  }
  await handleBatch('task', data?.locations ?? []);
});

// Stream 2 (primary on iOS 17+): CLLocationUpdate.liveUpdates inside a background activity session.
backgroundActivitySession.addLocationListener((locations) => void handleBatch('live', locations));
