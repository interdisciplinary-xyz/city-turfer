/**
 * Wires every context to its adapters. Lazy and React-free so the headless
 * background task can use it. One container (and one database) per user.
 */
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { OsmRouteEstimator } from '@/contexts/activity-log/infrastructure/osm-route-estimator';
import { SecureStoreGapEstimationSetting } from '@/contexts/activity-log/infrastructure/secure-store-gap-estimation-setting';
import { createIdentityApi } from '@/contexts/identity';
import { MockAuthGateway } from '@/contexts/identity/infrastructure/mock-auth-gateway';
import { SecureStoreSessionStore } from '@/contexts/identity/infrastructure/secure-store-session-store';
import { backgroundActivitySession } from '@/contexts/recording/infrastructure/background-activity-session';
import { ExpoLocationTracker, ExpoPermissionGateway } from '@/contexts/recording/infrastructure/expo-location-tracker';
import { liveSessionStore } from '@/contexts/recording/infrastructure/live-session-store';
import { openExpoDatabase } from '@/platform/expo-database';
import { migrate } from '@/platform/migrations';

import { type Container, wire } from './wiring';

// --- Identity (app-wide, no user database needed) ------------------------------

const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'mock';
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'poc';
if (AUTH_MODE === 'mock' && APP_ENV === 'production') {
  throw new Error('Mock authentication must not ship in a production build (docs/poc-plan.md §4.0).');
}

const sessionStore = new SecureStoreSessionStore();
const tracker = new ExpoLocationTracker();

export const identity = createIdentityApi({ auth: new MockAuthGateway(), sessions: sessionStore }, () =>
  tracker.isRunning()
);

// --- Per-user container ----------------------------------------------------------

const adapters = {
  tracker,
  permissions: new ExpoPermissionGateway(),
  notifier: liveSessionStore,
  ids: { next: () => Crypto.randomUUID() },
  router: new OsmRouteEstimator({ appVersion: Constants.expoConfig?.version ?? 'dev' }),
  gapRouting: {
    setting: new SecureStoreGapEstimationSetting(),
    // Street estimates only while the user has the app open: never on a headless launch.
    isForeground: () => AppState.currentState === 'active',
    wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  },
};

let current: { userId: string; promise: Promise<Container>; stop?: () => void } | null = null;

/** The signed-in user's container, or null when nobody is signed in. */
export async function getContainer(): Promise<Container | null> {
  const uid = await sessionStore.read().catch(() => null);
  if (!uid) return null;
  if (current?.userId === uid) return current.promise;
  const promise = (async () => {
    const db = await openExpoDatabase(`turftrack-${uid}.db`);
    await migrate(db);
    const c = wire(uid, db, adapters);
    // appState 'background' here means iOS/Android launched us headless (e.g. to deliver locations).
    const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    const fg = await Location.getForegroundPermissionsAsync().catch(() => null);
    c.diagnostics.log('launch', {
      appState: AppState.currentState,
      trackerRunning: await tracker.isRunning(),
      locationAlways: bg?.granted ?? null,
      preciseLocation: fg?.ios?.accuracy ? fg.ios.accuracy === 'full' : null,
      bgSessionAvailable: backgroundActivitySession.available,
      liveStreaming: backgroundActivitySession.isStreaming(),
      lowPowerMode: backgroundActivitySession.isLowPowerMode(),
    });
    void c.diagnostics.prune();
    // Repairs first, then finish any work interrupted by a crash (also delivers the repairs' events).
    void c
      .runMaintenance()
      .catch((e) => c.diagnostics.log('task-error', { code: 'maintenance', message: String(e) }))
      .finally(() => void c.dispatcher.dispatchPending().then(() => c.estimateGaps()));
    return c;
  })();
  const entry: NonNullable<typeof current> = { userId: uid, promise };
  current = entry;
  void promise.then(
    (c) => {
      // Gaps recorded while headless (or offline) are estimated once the user opens the app.
      const sub = AppState.addEventListener('change', (s) => s === 'active' && void c.estimateGaps());
      if (current === entry) entry.stop = () => sub.remove();
      else sub.remove();
    },
    () => undefined
  );
  promise.catch(() => {
    if (current?.promise === promise) current = null;
  });
  return promise;
}

/** Close the current user's database (after sign-out). */
export async function resetContainer(): Promise<void> {
  const c = current;
  current = null;
  c?.stop?.();
  if (c) await (await c.promise.catch(() => null))?.db.close();
}

export { backgroundActivitySession, liveSessionStore };
export type { Container };
