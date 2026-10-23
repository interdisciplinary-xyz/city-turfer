/**
 * The sync chain (docs/plans/sync-chain-testing-2026-10-22.md): phones running the real wiring,
 * outbox and SQL, backed up to a server that is either the in-memory FakeApiServer or a real API
 * (CITYTURFER_LIVE_API). Each scenario runs against both, so the fake cannot drift from the API
 * unnoticed. The server is only ever observed from outside: over HTTP for the real one.
 */
import { randomInt } from 'node:crypto';

import type { ConsentPurpose } from '@/contexts/cloud-backup/application/ports';
import { createFetchApiClient } from '@/contexts/cloud-backup/infrastructure/fetch-api-client';
import { FakeApiServer, nodeSha256 } from '@/contexts/cloud-backup/test-support/fake-api-server';
import { ApiAuthGateway } from '@/contexts/identity/infrastructure/api-auth-gateway';
import { migrate } from '@/platform/migrations';
import { phone as fakePhone } from '@/test-support/backup-phone';
import { type AccountActions, accountActions } from '@/test-support/chain/account-actions';
import { isPending, type Pending } from '@/test-support/chain/pending';
import { retryAfterWait } from '@/test-support/chain/retry';

export { isPending, type Pending, retryAfterWait };
import { openNodeDatabase } from '@/test-support/node-database';
import { type DeviceAdapters, wire } from '@/wiring';

export const LIVE_API = process.env.CITYTURFER_LIVE_API?.replace(/\/+$/, '') ?? null;
/** AUTH_FIXED_CODE of the API under test (codes work for @e2e.cityturfer.test addresses only). */
export const LIVE_CODE = process.env.CITYTURFER_LIVE_CODE ?? '000000';
const CLIENT = 'ios/chain-test';
/** One run id, so addresses never collide with an earlier run on the same database. */
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** What the server holds for one account, as a portal would read it. */
export interface ServerActivityView {
  id: string;
  name: string;
  type: string;
  source: string;
  /** Null on the fake, which stores uploads but computes no numbers. */
  distanceM: number | null;
  movingS: number | null;
}

export interface ServerView {
  activities(): Promise<ServerActivityView[]>;
  /** True when the server no longer serves the activity (404 or 410). */
  isGone(id: string): Promise<boolean>;
  /** True when the server keeps a tombstone for it (410): it was there and was deleted. */
  tombstoned(id: string): Promise<boolean>;
  consents(): Promise<Partial<Record<ConsentPurpose, boolean>>>;
  homeCityId(): Promise<string | null>;
  turfCellCount(): Promise<number | Pending>;
  /** Whether this phone's credentials still work (GET /v1/me). */
  signedIn(): Promise<boolean>;
}

export interface ChainPhone {
  c: ReturnType<typeof wire>;
  /** The server as seen with this phone's credentials. */
  server: ServerView;
  /** Requests this phone has sent to the server so far. */
  requests(): number;
  /** Requests other than GET (writes) this phone has sent so far. */
  writes(): number;
  /** Writes outside sign-in that the server refused (≥ 400): a silent 412 retry shows up here. */
  refusedWrites(): string[];
  /** Delete the account the way the web portal will (live only). */
  deleteAccount?(): Promise<void>;
  /**
   * Fail every write after the next `n` (live only): `'before-send'` drops the request, while
   * `'response-lost'` lets the server commit it and loses the answer.
   */
  dropNetworkAfter?(writes: number, mode?: 'before-send' | 'response-lost'): void;
  restoreNetwork?(): void;
  /** Live only: the account's address and this phone's session token (for a second client). */
  address?: string;
  token?: string;
  /** Live only: the account settings calls the phone's Account tab makes. */
  account?: AccountActions;
  /** Live only: "Export my data" from the phone (POST /v1/me/exports through its gateway). */
  requestExport?(): Promise<string>;
}

export interface PhoneOptions {
  /** Sign in with the account password instead of an e-mailed code (live only). */
  password?: string;
}

export interface ChainServer {
  name: 'fake' | 'live';
  /** A new phone (its own database) signed in to `account`. Phones with the same account share it. */
  phone(account: string, profile: string, options?: PhoneOptions): Promise<ChainPhone>;
}

// ---------------------------------------------------------------- fake

/** The ApiClient calls that change the server. */
const FAKE_WRITES = new Set<string>([
  'setConsent',
  'putActivity',
  'deleteActivity',
  'renameActivity',
  'putGapRoutes',
  'putHomeCity',
]);

export function fakeServer(): ChainServer {
  const servers = new Map<string, FakeApiServer>();
  return {
    name: 'fake',
    async phone(account, profile) {
      let server = servers.get(account);
      if (!server) {
        server = new FakeApiServer();
        servers.set(account, server);
      }
      const p = fakePhone({ server, profile, account: { token: server.validToken, accountId: 'acct-1' } });
      const c = await p.container();
      const s = server;
      const view: ServerView = {
        async activities() {
          return [...s.activities.entries()].map(([id, a]) => ({
            id,
            name: a.name,
            type: a.archive?.type ?? '',
            source: a.source,
            distanceM: null,
            movingS: null,
          }));
        },
        async isGone(id) {
          return !s.activities.has(id);
        },
        async tombstoned(id) {
          return s.tombstones.has(id);
        },
        async consents() {
          return Object.fromEntries([...s.consents].map(([k, v]) => [k, v.granted]));
        },
        async homeCityId() {
          return s.homeCity?.cityId ?? null;
        },
        async turfCellCount() {
          return { pending: 'the fake API has no server turf' };
        },
        async signedIn() {
          return true;
        },
      };
      const writes = () => s.requests.filter((r) => FAKE_WRITES.has(r.method));
      return {
        c,
        server: view,
        requests: () => s.requests.length,
        writes: () => writes().length,
        refusedWrites: () => [],
      };
    },
  };
}

// ---------------------------------------------------------------- live

interface Exchange {
  method: string;
  path: string;
  status: number;
}

/**
 * Each simulated phone or browser gets its own IP, as Vercel reports one per real device
 * (`x-real-ip`). Without it every client of a run shares the API's per-IP sign-in buckets, which no
 * real set of users does; the per-address limits still apply in full. Random, not counted: Jest
 * resets module state per test file, so a counter would repeat across files in one worker.
 */
export function deviceIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

/** The test address of an account label in this run (fixed sign-in codes work only for these). */
export const chainAddress = (account: string) =>
  account.includes('@') ? account : `${account}-${RUN}@e2e.cityturfer.test`;

/** A phone code sign-in through the app's own gateway, waiting out the one-code-a-minute limit. */
async function codeSignIn(gateway: ApiAuthGateway, address: string) {
  const sent = await retryAfterWait(() => gateway.requestCode({ value: address }));
  if (sent.kind !== 'sent') {
    throw new Error(`code request failed: ${sent.kind}`);
  }
  const verified = await gateway.verifyCode({ value: address }, LIVE_CODE);
  if (verified.kind !== 'verified') {
    throw new Error(`sign-in failed: ${verified.kind} (is the API running with AUTH_FIXED_CODE=${LIVE_CODE}?)`);
  }
  return verified.session;
}

/** A phone password sign-in through the app's own gateway ("Use a password instead"). */
async function passwordSignIn(gateway: ApiAuthGateway, address: string, password: string) {
  const verified = await gateway.signInWithPassword({ value: address }, password);
  if (verified.kind !== 'verified') {
    throw new Error(`password sign-in failed: ${verified.kind}`);
  }
  return verified.session;
}

export function liveServer(base: string): ChainServer {
  return {
    name: 'live',
    async phone(account, profile, options = {}) {
      const log: Exchange[] = [];
      const net = { writesLeft: Infinity, mode: 'before-send' as 'before-send' | 'response-lost' };
      const ip = deviceIp();
      const fetchImpl: typeof fetch = async (input, init) => {
        const method = init?.method ?? 'GET';
        const headers = new Headers(init?.headers);
        headers.set('x-real-ip', ip);
        init = { ...init, headers };
        const drop = method !== 'GET' && net.writesLeft-- <= 0;
        if (drop && net.mode === 'before-send') {
          throw new TypeError('Network request failed');
        }
        const res = await fetch(input, init);
        log.push({ method, path: new URL(String(input)).pathname, status: res.status });
        if (drop) {
          throw new TypeError('Network request failed');
        }
        return res;
      };
      const address = chainAddress(account);
      const gateway = new ApiAuthGateway({ baseUrl: base, client: CLIENT, timeoutMs: 20_000, fetchImpl });
      const session = options.password
        ? await passwordSignIn(gateway, address, options.password)
        : await codeSignIn(gateway, address);

      const db = openNodeDatabase();
      await migrate(db);
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
        ids: { next: () => `${profile}-${++n}` },
        timeZone: () => 'Europe/Warsaw',
        cloudBackup: {
          api: createFetchApiClient({ client: CLIENT, timeoutMs: 20_000, uploadTimeoutMs: 60_000, fetchImpl }),
          tokens: () => ({ read: async () => null, save: async () => undefined, clear: async () => undefined }),
          credentials: () => ({ current: async () => ({ token: session.token, accountId: session.account.id }) }),
          sha256: nodeSha256,
          serverUrl: base,
        },
      };
      const c = wire(profile, db, adapters);

      // The observer reads with plain fetch: its requests are not the phone's.
      const get = (path: string) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${session.token}` } });
      const json = async <T>(path: string): Promise<T> => {
        const res = await get(path);
        if (!res.ok) {
          throw new Error(`GET ${path} → ${res.status}`);
        }
        return (await res.json()) as T;
      };
      const activityStatus = async (id: string) => {
        const { status } = await get(`/v1/activities/${encodeURIComponent(id)}`);
        if (status !== 200 && status !== 404 && status !== 410) {
          throw new Error(`GET /v1/activities/${id} → ${status}`);
        }
        return status;
      };
      const view: ServerView = {
        async activities() {
          const out: ServerActivityView[] = [];
          let cursor: string | null = null;
          do {
            const page: { items: ServerActivityView[]; nextCursor: string | null } = await json(
              `/v1/activities${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
            );
            out.push(
              ...page.items.map(({ id, name, type, source, distanceM, movingS }) => ({
                id,
                name,
                type,
                source,
                distanceM,
                movingS,
              }))
            );
            cursor = page.nextCursor;
          } while (cursor);
          return out;
        },
        async isGone(id) {
          const status = await activityStatus(id);
          return status !== 200;
        },
        async tombstoned(id) {
          return (await activityStatus(id)) === 410;
        },
        async consents() {
          const { items } = await json<{ items: { purpose: ConsentPurpose; granted: boolean }[] }>('/v1/me/consents');
          return Object.fromEntries(items.map((x) => [x.purpose, x.granted]));
        },
        async homeCityId() {
          const { city } = await json<{ city: { id: string } | null }>('/v1/turf/home-city');
          return city?.id ?? null;
        },
        async turfCellCount() {
          const res = await get('/v1/turf/summary');
          if (res.status === 501) {
            return { pending: 'GET /v1/turf/summary answers 501 (server turf: lane C)' };
          }
          if (!res.ok) {
            throw new Error(`GET /v1/turf/summary → ${res.status}`);
          }
          return ((await res.json()) as { cellCount: number }).cellCount;
        },
        async signedIn() {
          const { status } = await get('/v1/me');
          if (status !== 200 && status !== 401) {
            throw new Error(`GET /v1/me → ${status}`);
          }
          return status === 200;
        },
      };
      return {
        c,
        server: view,
        requests: () => log.length,
        writes: () => log.filter((x) => x.method !== 'GET').length,
        refusedWrites: () =>
          log
            .filter((x) => x.method !== 'GET' && !x.path.includes('/auth/') && x.status >= 400)
            .map((x) => `${x.method} ${x.path} → ${x.status}`),
        async deleteAccount() {
          const r = await gateway.deleteAccount(session.token);
          if (r.kind !== 'deleted') {
            throw new Error(`delete account failed: ${r.kind}`);
          }
        },
        async requestExport() {
          return (await gateway.requestExport(session.token)).kind;
        },
        address,
        token: session.token,
        account: accountActions(gateway, session.token, get),
        dropNetworkAfter(writes, mode = 'before-send') {
          net.writesLeft = writes;
          net.mode = mode;
        },
        restoreNetwork() {
          net.writesLeft = Infinity;
        },
      };
    },
  };
}

/** The servers a chain test runs against: always the fake, the real API when CITYTURFER_LIVE_API names one. */
export const CHAIN_SERVERS: [string, () => ChainServer][] = [
  ['fake API', fakeServer],
  ...(LIVE_API ? [['live API', () => liveServer(LIVE_API)] as [string, () => ChainServer]] : []),
];
