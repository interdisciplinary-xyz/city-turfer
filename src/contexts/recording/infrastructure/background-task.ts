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
type Container = NonNullable<Awaited<ReturnType<typeof getContainer>>>;
type IngestResult = Awaited<ReturnType<Container['recording']['ingestFixes']['execute']>>;

/**
 * Both streams hand their batches to the container's Recording command queue
 * (shared with the UI's Start/Pause/Finish/...), which serializes the ingests.
 * This chain only keeps the hand-off in delivery order: looking up the
 * container is async, and a batch submitted out of order would see its fixes
 * dropped by the Fix Filter as out-of-order. It never waits for an ingest.
 */
let handoff: Promise<unknown> = Promise.resolve();
function enqueue(source: Source, locations: Location.LocationObject[]): Promise<void> {
  const submitted = handoff.then(async () => {
    const container = await getContainer();
    if (!container) return null;
    // Duplicates across the two streams are dropped by the Fix Filter (out-of-order).
    return { container, result: container.recording.ingestFixes.execute(locations.map(toFix)) };
  });
  handoff = submitted.catch(() => undefined);
  return ingest(source, locations, submitted);
}

async function stopAll() {
  await backgroundActivitySession.stop();
  await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
}

async function ingest(
  source: Source,
  locations: Location.LocationObject[],
  submitted: Promise<{ container: Container; result: Promise<IngestResult> } | null>
): Promise<void> {
  try {
    const handedOff = await submitted;
    if (!handedOff) {
      // Nobody signed in: an orphaned tracker must not keep draining the battery.
      await stopAll();
      return;
    }
    const { container } = handedOff;
    // No active session: IngestFixes already stopped the orphaned tracker, inside the queue.
    const result = await handedOff.result;
    const ts = locations.map((l) => l.timestamp);
    container.diagnostics.log('batch', {
      source,
      appState: AppState.currentState,
      bgSession: result.kind === 'ingested' ? result.keptAlive : null,
      received: locations.length,
      firstFixAgoS: ts.length ? Math.round((Date.now() - Math.min(...ts)) / 1000) : null,
      maxAccuracy: Math.max(0, ...locations.map((l) => l.coords.accuracy ?? 0)),
      ...(result.kind === 'ingested'
        ? { accepted: result.accepted, status: result.status, ...result.report }
        : { result: result.kind }),
    });
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
