/**
 * Wires every context to its adapters. Lazy and React-free so the headless
 * background task can use it. One container (and one database) per user.
 */
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import { createIdentityApi } from '@/contexts/identity';
import { MockAuthGateway } from '@/contexts/identity/infrastructure/MockAuthGateway';
import { SecureStoreSessionStore } from '@/contexts/identity/infrastructure/SecureStoreSessionStore';
import { ExpoLocationTracker, ExpoPermissionGateway } from '@/contexts/recording/infrastructure/ExpoLocationTracker';
import { liveSessionStore } from '@/contexts/recording/infrastructure/LiveSessionStore';
import { openExpoDatabase } from '@/platform/expoDatabase';
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
};

let current: { userId: string; promise: Promise<Container> } | null = null;

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
    c.diagnostics.log('launch', { appState: AppState.currentState, trackerRunning: await tracker.isRunning() });
    void c.diagnostics.prune();
    void c.dispatcher.dispatchPending(); // finish any work interrupted by a crash
    return c;
  })();
  current = { userId: uid, promise };
  promise.catch(() => {
    if (current?.promise === promise) current = null;
  });
  return promise;
}

/** Close the current user's database (after sign-out). */
export async function resetContainer(): Promise<void> {
  const c = current;
  current = null;
  if (c) await (await c.promise.catch(() => null))?.db.close();
}

export { liveSessionStore };
export type { Container };
