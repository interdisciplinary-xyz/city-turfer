import type { ActivityArchive } from '@/contexts/activity-log';
import type { HomeCityChoice } from '@/contexts/territory';

import type {
  ApiClient,
  ApiClientFactory,
  ApiFailure,
  ApiResult,
  ChangesPage,
  ConsentPurpose,
  DeviceTokenStore,
  ServerAccess,
  UploadSource,
} from '../application/ports';

type Method = keyof ApiClient;

export interface StoredActivity {
  version: number;
  content: string;
  source: UploadSource;
  timeZone: string | null;
  name: string;
  pointCount: number;
  gapRoutes: { checkedAt: number; count: number } | null;
}

export interface LoggedRequest {
  method: Method;
  id?: string;
  ifMatch?: number | null;
  baseUrl: string;
}

/**
 * The API contract (0.2.0) in memory, for tests: versions, If-Match (412/428), tombstones (410),
 * consents (403 without one), a valid token (401 otherwise), and failures injected per method.
 */
export class FakeApiServer {
  validToken = 'secret-token';
  readonly activities = new Map<string, StoredActivity>();
  readonly tombstones = new Set<string>();
  readonly consents = new Map<ConsentPurpose, { granted: boolean; policyVersion: string }>();
  readonly consentLog: { purpose: ConsentPurpose; granted: boolean; policyVersion: string }[] = [];
  homeCity: HomeCityChoice | null = null;
  readonly requests: LoggedRequest[] = [];
  /** Changes feed page size (to exercise paging). */
  pageSize = 500;
  private readonly failures = new Map<Method, ApiFailure[]>();
  private inFlight = 0;
  maxInFlight = 0;
  /** Each request takes this long (a timer, so concurrent uploads really overlap). */
  latencyMs = 1;

  /** The next `count` calls of `method` fail with `failure`. */
  failNext(method: Method, failure: ApiFailure, count = 1): void {
    this.failures.set(method, [...(this.failures.get(method) ?? []), ...Array<ApiFailure>(count).fill(failure)]);
  }

  /** The server already has this Activity (another install uploaded it). */
  seed(id: string, version = 1): void {
    this.activities.set(id, {
      version,
      content: 'seeded',
      source: 'recording',
      timeZone: null,
      name: 'Seeded',
      pointCount: 0,
      gapRoutes: null,
    });
  }

  uploads(): string[] {
    return this.requests.filter((r) => r.method === 'putActivity').map((r) => r.id!);
  }

  readonly factory: ApiClientFactory = (access) => this.client(access);

  private client(access: ServerAccess): ApiClient {
    const call = async <T>(
      method: Method,
      extra: Omit<LoggedRequest, 'method' | 'baseUrl'>,
      work: () => ApiResult<T>
    ) => {
      this.requests.push({ method, baseUrl: access.baseUrl, ...extra });
      this.inFlight++;
      this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
        if (access.token !== this.validToken) {
          return fail<T>({ kind: 'auth' });
        }
        const injected = this.failures.get(method)?.shift();
        if (injected) {
          return fail<T>(injected);
        }
        return work();
      } finally {
        this.inFlight--;
      }
    };
    const hasConsent = (p: ConsentPurpose) => this.consents.get(p)?.granted === true;

    return {
      setConsent: (purpose, granted, policyVersion) =>
        call('setConsent', {}, () => {
          this.consents.set(purpose, { granted, policyVersion });
          this.consentLog.push({ purpose, granted, policyVersion });
          return ok(undefined);
        }),
      changes: (cursor) =>
        call('changes', {}, () => {
          const all = [
            ...[...this.activities.entries()].map(([id, a]) => ({ kind: 'up' as const, id, version: a.version })),
            ...[...this.tombstones].map((id) => ({ kind: 'del' as const, id, version: 0 })),
          ];
          const start = cursor ? Number(cursor) : 0;
          const slice = all.slice(start, start + this.pageSize);
          const page: ChangesPage = {
            upserted: slice.filter((c) => c.kind === 'up').map((c) => ({ id: c.id, version: c.version })),
            deleted: slice.filter((c) => c.kind === 'del').map((c) => c.id),
            nextCursor: String(start + slice.length),
            hasMore: start + slice.length < all.length,
          };
          return ok(page);
        }),
      putActivity: (a: ActivityArchive, meta, ifMatch) =>
        call('putActivity', { id: a.id, ifMatch }, () => {
          if (
            !hasConsent('cloud-sync') ||
            (meta.source === 'apple-health' && !hasConsent('apple-health-in-cloud-sync'))
          ) {
            return fail({ kind: 'consent' });
          }
          if (this.tombstones.has(a.id)) {
            return fail({ kind: 'gone' });
          }
          const content = JSON.stringify([a.type, a.name, a.startedAt, a.endedAt, a.resumedSegments, a.track]);
          const existing = this.activities.get(a.id);
          const stored = (version: number): StoredActivity => ({
            version,
            content,
            source: meta.source,
            timeZone: meta.timeZone,
            name: a.name,
            pointCount: a.track.length,
            gapRoutes: existing?.gapRoutes ?? null,
          });
          if (!existing) {
            this.activities.set(a.id, stored(1));
            return ok({ version: 1 });
          }
          if (existing.content === content) {
            return ok({ version: existing.version });
          }
          if (ifMatch !== existing.version) {
            return fail({ kind: 'precondition' });
          }
          this.activities.set(a.id, stored(existing.version + 1));
          return ok({ version: existing.version + 1 });
        }),
      activityVersion: (id) =>
        call('activityVersion', { id }, () => {
          if (this.tombstones.has(id)) {
            return fail({ kind: 'gone' });
          }
          const a = this.activities.get(id);
          return a ? ok({ version: a.version }) : fail({ kind: 'not-found' });
        }),
      deleteActivity: (id) =>
        call('deleteActivity', { id }, () => {
          this.activities.delete(id);
          this.tombstones.add(id);
          return ok(undefined);
        }),
      putGapRoutes: (id, checkedAt, routes) =>
        call('putGapRoutes', { id }, () => {
          const a = this.activities.get(id);
          if (this.tombstones.has(id)) {
            return fail({ kind: 'gone' });
          }
          if (!a) {
            return fail({ kind: 'not-found' });
          }
          const version = a.version + 1;
          this.activities.set(id, { ...a, version, gapRoutes: { checkedAt, count: routes.length } });
          return ok({ version });
        }),
      putHomeCity: (choice) =>
        call('putHomeCity', {}, () => {
          if (!hasConsent('cloud-sync')) {
            return fail({ kind: 'consent' });
          }
          if (!this.homeCity || choice.chosenAt >= this.homeCity.chosenAt) {
            this.homeCity = choice;
          }
          return ok(undefined);
        }),
    };
  }
}

/** The device token in memory (expo-secure-store in the app). */
export class InMemoryDeviceTokenStore implements DeviceTokenStore {
  constructor(public token: string | null = null) {}
  async read() {
    return this.token;
  }
  async save(token: string) {
    this.token = token;
  }
  async clear() {
    this.token = null;
  }
}

const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });
const fail = <T>(failure: ApiFailure): ApiResult<T> => ({ ok: false, failure });
