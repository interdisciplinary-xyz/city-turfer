/**
 * Wires every context to its adapters. Lazy and React-free so the headless
 * background task can use it. One container (and one database) per user.
 */
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';

import { API_TIMEOUT_MS, API_UPLOAD_TIMEOUT_MS } from '@/constants/api';
import { OsmRouteEstimator } from '@/contexts/activity-log/infrastructure/osm-route-estimator';
import { SecureStoreGapEstimationSetting } from '@/contexts/activity-log/infrastructure/secure-store-gap-estimation-setting';
import { createFetchApiClient } from '@/contexts/cloud-backup/infrastructure/fetch-api-client';
import { SecureStoreDeviceTokenStore } from '@/contexts/cloud-backup/infrastructure/secure-store-device-token-store';
import { HealthKitHealthStore } from '@/contexts/health-sync/infrastructure/healthkit-health-store';
import { createIdentityApi } from '@/contexts/identity';
import { CachedSessionStore } from '@/contexts/identity/infrastructure/cached-session-store';
import { MockAuthGateway } from '@/contexts/identity/infrastructure/mock-auth-gateway';
import { SecureStoreSessionStore } from '@/contexts/identity/infrastructure/secure-store-session-store';
import { backgroundActivitySession } from '@/contexts/recording/infrastructure/background-activity-session';
import { ExpoLocationTracker, ExpoPermissionGateway } from '@/contexts/recording/infrastructure/expo-location-tracker';
import { liveSessionStore } from '@/contexts/recording/infrastructure/live-session-store';
import { openExpoDatabase } from '@/platform/expo-database';
import { runWhenForeground } from '@/platform/foreground';
import { migrate } from '@/platform/migrations';

import { type Container, wire } from './wiring';

// --- Identity (app-wide, no user database needed) ------------------------------

const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'mock';
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'poc';
if (AUTH_MODE === 'mock' && APP_ENV === 'production') {
  throw new Error('Mock authentication must not ship in a production build (docs/poc-plan.md §4.0).');
}

// One instance for sign-in, sign-out and getContainer(): it caches the signed-in uid in memory.
const sessionStore = new CachedSessionStore(new SecureStoreSessionStore());
const tracker = new ExpoLocationTracker();

export const identity = createIdentityApi({ auth: new MockAuthGateway(), sessions: sessionStore }, isRecording);

/** Sign-out gate: the domain's active Recording Session, not whether the OS tracker happens to run. */
async function isRecording(): Promise<boolean> {
  const c = await getContainer().catch(() => null);
  if (!c) {
    return tracker.isRunning();
  }
  return c.hasActiveSession().catch(() => true); // unknown: don't sign out from under a recording
}

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
  health: new HealthKitHealthStore(),
  isForeground: () => AppState.currentState === 'active',
  cloudBackup: {
    api: createFetchApiClient({
      client: `${Platform.OS}/${Constants.expoConfig?.version ?? 'dev'}`,
      timeoutMs: API_TIMEOUT_MS,
      uploadTimeoutMs: API_UPLOAD_TIMEOUT_MS,
    }),
    tokens: (userId: string) => new SecureStoreDeviceTokenStore(userId),
    timeZone: deviceTimeZone,
  },
};

/** The device's IANA zone (sent with uploads; activities recorded before backup get the current one). */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

let current: {
  userId: string;
  promise: Promise<Container>;
  cancelMaintenance: () => void;
  stop?: () => void;
} | null = null;

/**
 * The signed-in user's container, or null when nobody is signed in. Rejects
 * when the signed-in user can't be determined (keychain read error): that is
 * NOT "nobody is signed in", callers must not stop a recording because of it.
 */
export async function getContainer(): Promise<Container | null> {
  const uid = await sessionStore.read();
  if (!uid) {
    return null;
  }
  if (current?.userId === uid) {
    return current.promise;
  }
  let cancelMaintenance: () => void = () => undefined; // set once the container is wired
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
    // Not on headless launches (OS delivering locations): only once the user has the app open.
    cancelMaintenance = runWhenForeground(AppState, () => void c.runLaunchMaintenance().catch(() => undefined));
    return c;
  })();
  const entry: NonNullable<typeof current> = { userId: uid, promise, cancelMaintenance: () => cancelMaintenance() };
  current = entry;
  void promise.then(
    (c) => {
      // Gaps recorded while headless (or offline) are estimated, new Apple Health workouts
      // imported and queued backup work sent whenever the user brings the app back.
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') {
          void c.estimateGaps();
          void c.syncHealth();
          void c.backUp();
        }
      });
      if (current === entry) {
        entry.stop = () => sub.remove();
      } else {
        sub.remove();
      }
    },
    () => undefined
  );
  promise.catch(() => {
    if (current?.promise === promise) {
      current = null;
    }
  });
  return promise;
}

/** Close the current user's database (after sign-out). */
export async function resetContainer(): Promise<void> {
  const c = current;
  current = null;
  c?.cancelMaintenance();
  c?.stop?.();
  if (c) {
    await (await c.promise.catch(() => null))?.db.close();
  }
}

export { backgroundActivitySession, liveSessionStore };
export type { Container };
