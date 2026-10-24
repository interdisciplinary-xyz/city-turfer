/**
 * One phone with the app's real Identity wiring for the local profiles (mock admin, demo), for the
 * sync chain: password sign-in on the phone, "Email me a code" to the profile's own address against
 * a real API, the keychain's single credential slot and the profile map in memory, and one SQLite
 * database per profile. Backup reads its bearer through Identity's `accountBearer`, exactly as the
 * composition root does, so "no server credentials after a password sign-in" is the app's own rule.
 *
 * The chain's API process is the local dev server (PGlite in memory), which knows admin@ and
 * demo@cityturfer.com and accepts AUTH_FIXED_CODE for them (apps/api/src/server.ts), so these two
 * real addresses are used as they are; nothing here maps test addresses onto the profiles.
 */
import { createIdentityApi } from '@cityturfer/core/identity';
import {
  type AccountProfileStore,
  type AccountSession,
  type CredentialStore,
  type SessionStore,
  userId,
} from '@cityturfer/core/identity/ports';

import { createFetchApiClient } from '@/contexts/cloud-backup/infrastructure/fetch-api-client';
import { nodeSha256 } from '@/contexts/cloud-backup/test-support/fake-api-server';
import { ApiAuthGateway } from '@/contexts/identity/infrastructure/api-auth-gateway';
import { MockAuthGateway } from '@/contexts/identity/infrastructure/mock-auth-gateway';
import { migrate } from '@/platform/migrations';
import { deviceIp, retryAfterWait } from '@/test-support/chain/chain-server';
import { readActivities, type ServerActivityView } from '@/test-support/chain/server-reads';
import { openNodeDatabase } from '@/test-support/node-database';
import { type DeviceAdapters, wire } from '@/wiring';

const CLIENT = 'ios/chain-test';

export const PROFILES = {
  admin: { email: 'admin@cityturfer.com', password: 'admin1234' },
  demo: { email: 'demo@cityturfer.com', password: 'demo1234' },
} as const;
export type LocalProfileId = keyof typeof PROFILES;

export function localProfilePhone(base: string, code: string) {
  const ip = deviceIp();
  const log: { method: string; path: string; status: number }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('x-real-ip', ip);
    const res = await fetch(input, { ...init, headers });
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    log.push({ method: init?.method ?? 'GET', path: url.pathname, status: res.status });
    return res;
  };

  let session: ReturnType<typeof userId> | null = null;
  let credentials: AccountSession | null = null;
  let profiles: Awaited<ReturnType<AccountProfileStore['read']>> = null;
  const sessions: SessionStore = {
    read: async () => session,
    write: async (id) => void (session = id),
    clear: async () => void (session = null),
  };
  const credentialStore: CredentialStore = {
    read: async () => credentials,
    save: async (s) => void (credentials = s),
    clear: async () => void (credentials = null),
  };
  const profileStore: AccountProfileStore = { read: async () => profiles, write: async (s) => void (profiles = s) };
  const identity = createIdentityApi(
    {
      auth: new MockAuthGateway(),
      sessions,
      accounts: {
        gateway: new ApiAuthGateway({ baseUrl: base, client: CLIENT, timeoutMs: 20_000, fetchImpl }),
        credentials: credentialStore,
        profiles: profileStore,
        history: { hasActivities: async () => false },
      },
    },
    async () => false
  );

  let n = 0;
  const adapters: DeviceAdapters = {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    ids: { next: () => `chain-${++n}` },
    timeZone: () => 'Europe/Warsaw',
    cloudBackup: {
      api: createFetchApiClient({ client: CLIENT, timeoutMs: 20_000, uploadTimeoutMs: 60_000, fetchImpl }),
      tokens: () => ({ read: async () => null, save: async () => undefined, clear: async () => undefined }),
      credentials: (profileId) => ({ current: () => identity.accountBearer.execute(profileId) }),
      sha256: nodeSha256,
      serverUrl: base,
    },
  };
  const containers = new Map<string, Awaited<ReturnType<typeof open>>>();
  async function open(profile: LocalProfileId) {
    const db = openNodeDatabase();
    await migrate(db);
    return wire(profile, db, adapters);
  }

  return {
    identity,
    log,
    /** Writes the phone sent to the API outside sign-in. */
    writes: () => log.filter((x) => x.method !== 'GET' && !x.path.includes('/auth/')).length,
    /** The profile's container (its own database), created on first use and kept. */
    async container(profile: LocalProfileId) {
      let c = containers.get(profile);
      if (!c) {
        c = await open(profile);
        containers.set(profile, c);
      }
      return c;
    },
    /** The Welcome screen's password sign-in of a local profile. */
    async passwordSignIn(profile: LocalProfileId) {
      return identity.signIn.execute(PROFILES[profile].email, PROFILES[profile].password);
    },
    async signOut() {
      return identity.signOut.execute();
    },
    /** Info › Cloud backup › "Email me a code", then the code (waits out the one-code-a-minute limit). */
    async linkByCode(profile: LocalProfileId) {
      const sent = await retryAfterWait(() => identity.requestBackupLinkCode.execute(profile));
      if (sent.kind !== 'sent') {
        throw new Error(`code request failed: ${sent.kind}`);
      }
      return identity.linkSignedInProfile.execute(profile, code);
    },
    /** The server's activities with the profile's account (null: no server credentials). */
    async serverActivities(profile: LocalProfileId): Promise<ServerActivityView[] | null> {
      const bearer = await identity.accountBearer.execute(profile);
      if (!bearer) {
        return null;
      }
      return readActivities((path) =>
        fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${bearer.token}` } })
      );
    },
  };
}
