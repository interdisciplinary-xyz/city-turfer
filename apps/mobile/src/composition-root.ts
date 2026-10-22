/**
 * Wires every context to its adapters. Lazy and React-free so the headless
 * background task can use it. One container (and one database) per user.
 */
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';

import { API_BASE_URL, API_TIMEOUT_MS, API_UPLOAD_TIMEOUT_MS } from '@/constants/api';
import { OsmRouteEstimator } from '@/contexts/activity-log/infrastructure/osm-route-estimator';
import { SecureStoreGapEstimationSetting } from '@/contexts/activity-log/infrastructure/secure-store-gap-estimation-setting';
import type { DeviceTokenStore } from '@/contexts/cloud-backup';
import { createFetchApiClient } from '@/contexts/cloud-backup/infrastructure/fetch-api-client';
import { SecureStoreDeviceTokenStore } from '@/contexts/cloud-backup/infrastructure/secure-store-device-token-store';
import { HealthKitHealthStore } from '@/contexts/health-sync/infrastructure/healthkit-health-store';
import { createIdentityApi } from '@/contexts/identity';
import { ApiAuthGateway } from '@/contexts/identity/infrastructure/api-auth-gateway';
import { CachedSessionStore } from '@/contexts/identity/infrastructure/cached-session-store';
import { MockAuthGateway } from '@/contexts/identity/infrastructure/mock-auth-gateway';
import { SecureStoreAccountProfileStore } from '@/contexts/identity/infrastructure/secure-store-account-profile-store';
import { SecureStoreCredentialStore } from '@/contexts/identity/infrastructure/secure-store-credential-store';
import { SecureStoreSessionStore } from '@/contexts/identity/infrastructure/secure-store-session-store';
import { backgroundActivitySession } from '@/contexts/recording/infrastructure/background-activity-session';
import { ExpoLocationTracker, ExpoPermissionGateway } from '@/contexts/recording/infrastructure/expo-location-tracker';
import { liveSessionStore } from '@/contexts/recording/infrastructure/live-session-store';
import { deleteExpoDatabase, openExpoDatabase } from '@/platform/expo-database';
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

const CLIENT = `${Platform.OS}/${Constants.expoConfig?.version ?? 'dev'}`;
const databaseName = (profileId: string) => `turftrack-${profileId}.db`;

/**
 * Local profiles (mock admin + demo, password) in every build, and real accounts (email one-time
 * code) against the API. Only foreground code paths use the account parts: the background location
 * task reads the signed-in profile id (sessionStore) and nothing else.
 */
export const identity = createIdentityApi(
  {
    auth: new MockAuthGateway(),
    sessions: sessionStore,
    accounts: {
      gateway: new ApiAuthGateway({ baseUrl: API_BASE_URL, client: CLIENT, timeoutMs: API_TIMEOUT_MS }),
      credentials: new SecureStoreCredentialStore(),
      profiles: new SecureStoreAccountProfileStore(),
      history: { hasActivities: profileHasActivities },
    },
  },
  isRecording
);

/** Does a local profile's database hold activities (the history a first real sign-in may adopt)? */
async function profileHasActivities(profileId: string): Promise<boolean> {
  if (current?.userId === profileId) {
    const c = await current.promise.catch(() => null);
    return c ? (await c.activityLog.list.execute(1)).length > 0 : false;
  }
  const db = await openExpoDatabase(databaseName(profileId)).catch(() => null);
  if (!db) {
    return false;
  }
  try {
    return (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM log_activities'))!.n > 0;
  } catch {
    return false; // never opened before: no tables
  } finally {
    await db.close().catch(() => undefined);
  }
}

/** Deletes a signed-out profile's database (after deleting the account, if the Turfer asked to). */
export async function deleteProfileData(profileId: string): Promise<void> {
  if (current?.userId === profileId) {
    await resetContainer();
  }
  await deleteExpoDatabase(databaseName(profileId));
}

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
      client: CLIENT,
      timeoutMs: API_TIMEOUT_MS,
      uploadTimeoutMs: API_UPLOAD_TIMEOUT_MS,
    }),
    tokens: (userId: string) => new SecureStoreDeviceTokenStore(userId),
    // The signed-in account's bearer (Identity), else the Developer tools device token.
    credentials: (userId: string, deviceToken: DeviceTokenStore) => ({
      current: async () => {
        const account = await identity.accountBearer.execute(userId);
        if (account) {
          return account;
        }
        const token = await deviceToken.read();
        return token ? { token, accountId: null } : null;
      },
    }),
    sha256: (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  },
  timeZone: deviceTimeZone,
};

/** The device's IANA zone, kept with each new Activity (older ones get the current zone once). */
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
    const db = await openExpoDatabase(databaseName(uid));
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
