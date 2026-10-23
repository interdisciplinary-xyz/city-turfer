/**
 * Wires every context to its adapters. Lazy and React-free so the headless
 * background task can use it. One container (and one database) per user.
 */
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { API_BASE_URL, API_TIMEOUT_MS, API_UPLOAD_TIMEOUT_MS } from '@/constants/api';
import { onboardingDismissal } from '@/contexts/achievements/infrastructure/onboarding-dismissal';
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
import { SecureStoreProfileNameStore } from '@/contexts/identity/infrastructure/secure-store-profile-name-store';
import { SecureStoreSessionStore } from '@/contexts/identity/infrastructure/secure-store-session-store';
import { backgroundActivitySession } from '@/contexts/recording/infrastructure/background-activity-session';
import { ExpoLocationTracker, ExpoPermissionGateway } from '@/contexts/recording/infrastructure/expo-location-tracker';
import { liveSessionStore } from '@/contexts/recording/infrastructure/live-session-store';
import { turfOverlayPreference } from '@/contexts/territory/infrastructure/turf-overlay-preference';
import { deleteExpoDatabase, openExpoDatabase } from '@/platform/expo-database';
import { runWhenForeground } from '@/platform/foreground';
import { migrate } from '@/platform/migrations';
import { ProfileDeletions } from '@/platform/profile-deletions';

import { type Container, wire } from './wiring';

// --- Identity (app-wide, no user database needed) ------------------------------

// One instance for sign-in, sign-out and getContainer(): it caches the signed-in uid in memory.
const sessionStore = new CachedSessionStore(new SecureStoreSessionStore());
const tracker = new ExpoLocationTracker();
const profileNames = new SecureStoreProfileNameStore();

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
    names: profileNames,
  },
  isRecording
);

/** Does a local profile's database hold activities (the history a first real sign-in may adopt)? */
async function profileHasActivities(profileId: string): Promise<boolean> {
  if (current?.userId === profileId) {
    const c = await current.promise.catch(() => null);
    return c ? (await c.activityLog.list.execute(1)).length > 0 : false;
  }
  // expo-sqlite has no "does it exist" nor read-only open, and expo-file-system is not a dependency
  // of the app (adding it changes the runtime fingerprint). So: open, and if the file holds no
  // tables at all it was never used (this probe just created it): delete it again, so asking
  // leaves no empty database behind.
  const name = databaseName(profileId);
  const db = await openExpoDatabase(name).catch(() => null);
  if (!db) {
    return false;
  }
  let unused = false;
  try {
    unused = (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sqlite_master'))!.n === 0;
    return !unused && (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM log_activities'))!.n > 0;
  } catch {
    return false; // not migrated that far: no activities
  } finally {
    await db.close().catch(() => undefined);
    if (unused) {
      await deleteExpoDatabase(name).catch(() => undefined);
    }
  }
}

const PENDING_DELETIONS_KEY = 'cityturfer.profiles.pending-deletion';

/** A profile's database and its per-profile keychain items. A database already gone counts as deleted. */
async function eraseProfile(profileId: string): Promise<void> {
  await deleteExpoDatabase(databaseName(profileId)).catch((e: unknown) => {
    if (!/not found/i.test(String((e as Error)?.message))) {
      throw e;
    }
  });
  await new SecureStoreDeviceTokenStore(profileId).clear();
  await onboardingDismissal.forget(profileId);
  await turfOverlayPreference.forget(profileId);
  await profileNames.forget(profileId);
}

/** Profile deletions that must finish (ids only, in the keychain: they survive a restart). */
const profileDeletions = new ProfileDeletions(
  {
    read: async () => {
      const raw = await SecureStore.getItemAsync(PENDING_DELETIONS_KEY);
      const ids: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    },
    write: (ids) =>
      ids.length > 0
        ? SecureStore.setItemAsync(PENDING_DELETIONS_KEY, JSON.stringify(ids))
        : SecureStore.deleteItemAsync(PENDING_DELETIONS_KEY),
  },
  eraseProfile
);

/**
 * Deletes a signed-out profile's data on this phone (after deleting the account, if the Turfer asked
 * to): its database and keychain items. Throws when that failed; it is then retried on the next
 * launch (retryProfileDeletions) or before the profile is opened again.
 */
export async function deleteProfileData(profileId: string): Promise<void> {
  if (current?.userId === profileId) {
    await resetContainer();
  }
  await profileDeletions.delete(profileId);
}

/** Launch (foreground): finishes profile deletions that failed before. Never throws. */
export async function retryProfileDeletions(): Promise<void> {
  const signedIn = await sessionStore.read().catch(() => null);
  await profileDeletions.retry(signedIn);
}

/** A sign-in is about to open this profile: finish a deletion still pending for it first. */
export function finishProfileDeletion(profileId: string): Promise<void> {
  return profileDeletions.beforeOpening(profileId);
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
