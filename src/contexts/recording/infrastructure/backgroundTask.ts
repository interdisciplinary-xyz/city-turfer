/**
 * Driving adapter: the OS delivers location batches here — with the app in
 * the foreground, in the background, or after a headless relaunch. Must be
 * imported first (see /index.ts) so the task is defined in the global scope.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { getContainer } from '@/composition-root';

import { backgroundActivitySession } from './BackgroundActivitySession';
import { LOCATION_TASK, toFix } from './ExpoLocationTracker';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.warn('[location-task]', error.message);
    void getContainer()
      .then((c) => c?.diagnostics.log('task-error', { code: error.code, message: error.message }))
      .catch(() => undefined);
    return;
  }
  try {
    const container = await getContainer();
    if (!container) {
      // Nobody signed in: an orphaned tracker must not keep draining the battery.
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
      return;
    }
    const locations = data?.locations ?? [];
    const result = await container.recording.ingestFixes.execute(locations.map(toFix));
    const ts = locations.map((l) => l.timestamp);
    // The session lives in native memory: re-acquire it if iOS relaunched us.
    const bgSession = result.kind === 'ingested' ? await backgroundActivitySession.ensure() : null;
    container.diagnostics.log('batch', {
      appState: AppState.currentState,
      bgSession,
      received: locations.length,
      firstFixAgoS: ts.length ? Math.round((Date.now() - Math.min(...ts)) / 1000) : null,
      maxAccuracy: Math.max(0, ...locations.map((l) => l.coords.accuracy ?? 0)),
      ...(result.kind === 'ingested'
        ? { accepted: result.accepted, status: result.status, ...result.report }
        : { result: result.kind }),
    });
    if (result.kind === 'no-active-session') {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
    }
  } catch (e) {
    if (__DEV__) console.warn('[location-task] ingest failed', e);
    void getContainer()
      .then((c) => c?.diagnostics.log('task-error', { code: 'ingest', message: String(e) }))
      .catch(() => undefined);
  }
});
