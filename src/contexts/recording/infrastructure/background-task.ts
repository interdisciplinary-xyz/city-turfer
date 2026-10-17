/**
 * Driving adapter: the OS delivers location batches here — with the app in
 * the foreground, in the background, or after a headless relaunch. Must be
 * imported first (see /index.ts) so the task is defined in the global scope.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { getContainer } from '@/composition-root';
import { LOCATION_TASK } from '@/constants/location';

import { backgroundActivitySession } from './background-activity-session';
import { toFix } from './expo-location-tracker';

type Source = 'task' | 'live';

/** Both streams feed one queue: concurrent ingests would overwrite each other's session state. */
let queue: Promise<void> = Promise.resolve();
function enqueue(source: Source, locations: Location.LocationObject[]) {
  queue = queue.then(() => ingest(source, locations));
  return queue;
}

async function stopAll() {
  await backgroundActivitySession.stop();
  await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
}

async function ingest(source: Source, locations: Location.LocationObject[]): Promise<void> {
  try {
    const container = await getContainer();
    if (!container) {
      // Nobody signed in: an orphaned tracker must not keep draining the battery.
      await stopAll();
      return;
    }
    // Duplicates across the two streams are dropped by the Fix Filter (out-of-order).
    const result = await container.recording.ingestFixes.execute(locations.map(toFix));
    const ts = locations.map((l) => l.timestamp);
    // The session lives in native memory: re-acquire it if iOS relaunched us.
    const bgSession = result.kind === 'ingested' ? await backgroundActivitySession.ensure() : null;
    // audit-logs-allow: `l.coords.accuracy` is a horizontal accuracy in metres (a number), not a position
    container.diagnostics.log('batch', {
      source,
      appState: AppState.currentState,
      bgSession,
      received: locations.length,
      firstFixAgoS: ts.length ? Math.round((Date.now() - Math.min(...ts)) / 1000) : null,
      maxAccuracy: Math.max(0, ...locations.map((l) => l.coords.accuracy ?? 0)),
      ...(result.kind === 'ingested'
        ? { accepted: result.accepted, status: result.status, ...result.report }
        : { result: result.kind }),
    });
    if (result.kind === 'no-active-session') await stopAll();
  } catch (e) {
    if (__DEV__) console.warn('[location-task] ingest failed', e);
    void getContainer()
      .then((c) => c?.diagnostics.log('task-error', { code: `ingest-${source}`, message: String(e) }))
      .catch(() => undefined);
  }
}

// Stream 1 (safety net): expo-location's background task (CLLocationManager + significant-change wake-ups).
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.warn('[location-task]', error.message);
    void getContainer()
      .then((c) => c?.diagnostics.log('task-error', { code: error.code, message: error.message }))
      .catch(() => undefined);
    return;
  }
  await enqueue('task', data?.locations ?? []);
});

// Stream 2 (primary on iOS 17+): CLLocationUpdate.liveUpdates inside a background activity session.
backgroundActivitySession.addLocationListener((locations) => void enqueue('live', locations));
