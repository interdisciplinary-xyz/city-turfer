/**
 * A phone for Cloud Backup / Restore integration tests: the real wiring, outbox and SQL (better-sqlite3)
 * against an in-memory API server that several phones may share.
 */
import type { DeviceTokenStore } from '@/contexts/cloud-backup';
import {
  FakeAccountCredentials,
  FakeApiServer,
  InMemoryDeviceTokenStore,
  nodeSha256,
} from '@/contexts/cloud-backup/test-support/fake-api-server';
import { migrate } from '@/platform/migrations';
import type { TrackPoint } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';
import { type DeviceAdapters, wire } from '@/wiring';

export const T0 = Date.parse('2026-10-01T07:00:00Z');
export const DAY = 86_400_000;

/** A short walk on day `day` (20 points, 5 s apart); `gapAt` puts a 10-minute pause inside segment 0. */
export function walk(day: number, gapAt?: number): TrackPoint[] {
  return Array.from({ length: 20 }, (_, i) => ({
    lat: 52.25 + day * 0.001 + i * 0.00005,
    lon: 21.01 + i * 0.00005,
    t: T0 + day * DAY + i * 5_000 + (gapAt != null && i >= gapAt ? 600_000 : 0),
    segment: 0,
    alt: i === 0 ? null : 100,
    accuracy: 5,
    speed: 1.4,
  }));
}

export interface PhoneOptions {
  /** The Developer tools device token; the server names its account (GET /v1/me). Default: a valid one. */
  token?: string | null;
  /** A signed-in account instead (Identity's bearer token with its account id). */
  account?: { token: string; accountId: string } | null;
  /** The local profile (database) id. Default 'test'. */
  profile?: string;
  /** Share one server between phones. */
  server?: FakeApiServer;
  /** Street router answers (default: no route); calls are counted in `routerCalls`. */
  route?: DeviceAdapters['router']['route'];
  /** Gap estimation on (default off). */
  gapRouting?: boolean;
  /** No backup server configured in this build (`cloudBackup` adapters omitted): nothing is ever sent. */
  noBackupAdapters?: boolean;
  /** Extra adapters (e.g. a HealthStore). */
  extra?: Partial<DeviceAdapters>;
}

export function phone(options: PhoneOptions = {}) {
  const db = openNodeDatabase();
  const server = options.server ?? new FakeApiServer();
  const tokens = new InMemoryDeviceTokenStore(options.token === undefined ? 'secret-token' : options.token);
  const account = new FakeAccountCredentials(options.account ?? null);
  let now = Date.parse('2026-10-20T12:00:00Z');
  const app = { foreground: true, timeZone: 'Europe/Warsaw' as string | null };
  const routerCalls = { n: 0 };
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
    router: {
      route: async (from, to, type) => {
        routerCalls.n++;
        return options.route ? options.route(from, to, type) : null;
      },
    },
    gapRouting: options.gapRouting
      ? {
          setting: { isEnabled: async () => true, setEnabled: async () => undefined },
          isForeground: () => app.foreground,
          wait: async () => undefined,
        }
      : undefined,
    ids: { next: () => `session-${++n}` },
    clock: { now: () => now },
    isForeground: () => app.foreground,
    cloudBackup: options.noBackupAdapters
      ? undefined
      : {
          api: server.factory,
          tokens: () => tokens,
          sha256: nodeSha256,
          credentials: (_: string, device: DeviceTokenStore) => ({
            current: async () => {
              const signedIn = await account.current();
              if (signedIn) {
                return signedIn;
              }
              const token = await device.read();
              return token ? { token, accountId: null } : null;
            },
          }),
        },
    timeZone: () => app.timeZone,
    ...options.extra,
  };
  return {
    db,
    server,
    tokens,
    account,
    app,
    routerCalls,
    adapters,
    advance: (ms: number) => void (now += ms),
    async container() {
      await migrate(db);
      const c = wire(options.profile ?? 'test', db, adapters);
      /** Import and let the outbox deliver (claims turf, queues backup work). */
      const add = async (id: string, points: TrackPoint[]) => {
        await c.activityLog.importActivity.execute({ id, type: 'walk', points });
        await c.dispatcher.dispatchPending();
      };
      return Object.assign(c, { add });
    },
  };
}

export type Phone = ReturnType<typeof phone>;
export type PhoneContainer = Awaited<ReturnType<Phone['container']>>;
