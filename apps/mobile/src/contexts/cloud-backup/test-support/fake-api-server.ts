import { createHash } from 'node:crypto';

import type { ActivityArchive } from '@/contexts/activity-log';
import type { HomeCityChoice } from '@/contexts/territory';

import type {
  ApiClient,
  ApiClientFactory,
  ApiFailure,
  ApiResult,
  BackupCredentials,
  ChangesPage,
  ConsentPurpose,
  DeviceTokenStore,
  ServerAccess,
  ServerActivity,
  Sha256,
  UploadSource,
} from '../application/ports';
import { trackHashInput } from '../domain/backup-policy';

type Method = keyof ApiClient;

export interface StoredActivity {
  version: number;
  content: string;
  source: UploadSource;
  timeZone: string | null;
  name: string;
  renamedAt: number | null;
  pointCount: number;
  trackHash: string;
  gapRoutes: { checkedAt: number; count: number } | null;
  /** What a restore downloads (null for seeded rows without content). */
  archive: ActivityArchive | null;
}

export interface LoggedRequest {
  method: Method;
  id?: string;
  ifMatch?: number | null;
  baseUrl: string;
}

/** SHA-256 hex in Node (expo-crypto on the phone). */
export const nodeSha256: Sha256 = async (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const hashOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * The API contract (0.4.0) in memory, for tests: one account per token, versions, If-Match
 * (412/428), tombstones (410), renames (last `renamedAt` wins), consents (403 without one;
 * withdrawing one erases what it covered, adds no tombstones and keeps existing ones), whole copies for restore, and
 * failures injected per method.
 */
export class FakeApiServer {
  validToken = 'secret-token';
  /** Account id of a token (GET /v1/me); any other valid token is 'acct-1'. */
  readonly accounts = new Map<string, string>([['secret-token', 'acct-1']]);
  /** More valid tokens, with their account (another account on the same server). */
  readonly moreTokens = new Map<string, string>();
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
  /** Called before each request is answered (e.g. to "kill" a phone mid-restore). */
  onRequest: ((r: LoggedRequest) => void) | null = null;

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
      renamedAt: null,
      pointCount: 0,
      trackHash: 'seeded',
      gapRoutes: null,
      archive: null,
    });
  }

  /** The server already has this content (another install, or this phone before a reinstall). */
  seedCopy(a: ActivityArchive, version = 1, timeZone: string | null = a.timeZone): void {
    this.activities.set(a.id, {
      version,
      content: 'seeded',
      source: a.id.startsWith('hk-') ? 'apple-health' : 'recording',
      timeZone,
      name: a.name,
      renamedAt: a.renamedAt,
      pointCount: a.track.length,
      trackHash: hashOf(trackHashInput(a.track)),
      gapRoutes: a.gapsCheckedAt != null ? { checkedAt: a.gapsCheckedAt, count: a.gapRoutes.length } : null,
      archive: JSON.parse(JSON.stringify(a)) as ActivityArchive,
    });
  }

  uploads(): string[] {
    return this.requests.filter((r) => r.method === 'putActivity').map((r) => r.id!);
  }

  calls(method: Method): LoggedRequest[] {
    return this.requests.filter((r) => r.method === method);
  }

  readonly factory: ApiClientFactory = (access) => this.client(access);

  private erase(purpose: ConsentPurpose): void {
    for (const id of [...this.activities.keys()]) {
      if (purpose === 'cloud-sync' || id.startsWith('hk-')) {
        this.activities.delete(id);
      }
    }
    if (purpose === 'cloud-sync') {
      this.homeCity = null;
    }
  }

  private client(access: ServerAccess): ApiClient {
    const call = async <T>(
      method: Method,
      extra: Omit<LoggedRequest, 'method' | 'baseUrl'>,
      work: () => ApiResult<T>
    ) => {
      const logged = { method, baseUrl: access.baseUrl, ...extra };
      this.requests.push(logged);
      this.inFlight++;
      this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
        this.onRequest?.(logged);
        if (access.token !== this.validToken && !this.moreTokens.has(access.token)) {
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
      me: () =>
        call('me', {}, () => {
          return ok({ id: this.moreTokens.get(access.token) ?? this.accounts.get(access.token) ?? 'acct-1' });
        }),
      setConsent: (purpose, granted, policyVersion) =>
        call('setConsent', {}, () => {
          this.consents.set(purpose, { granted, policyVersion });
          this.consentLog.push({ purpose, granted, policyVersion });
          if (!granted) {
            this.erase(purpose);
          }
          return ok(undefined);
        }),
      consents: () =>
        call('consents', {}, () =>
          ok([...this.consents.entries()].map(([purpose, c]) => ({ purpose, granted: c.granted })))
        ),
      changes: (cursor) =>
        call('changes', {}, () => {
          const all = [
            ...[...this.activities.entries()].map(([id, a]) => ({ kind: 'up' as const, id, a })),
            ...[...this.tombstones].map((id) => ({ kind: 'del' as const, id, a: null })),
            ...(this.homeCity ? [{ kind: 'home' as const, id: '', a: null }] : []),
          ];
          const start = cursor ? Number(cursor) : 0;
          const slice = all.slice(start, start + this.pageSize);
          const page: ChangesPage = {
            upserted: slice.flatMap((c): ServerActivity[] =>
              c.kind === 'up' && c.a
                ? [
                    {
                      id: c.id,
                      version: c.a.version,
                      startedAt: c.a.archive?.startedAt ?? 0,
                      name: c.a.name,
                      trackHash: c.a.trackHash,
                    },
                  ]
                : []
            ),
            deleted: slice.filter((c) => c.kind === 'del').map((c) => c.id),
            homeCity: slice.some((c) => c.kind === 'home') ? this.homeCity : null,
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
          if ((meta.source === 'apple-health') !== a.id.startsWith('hk-')) {
            return fail({ kind: 'rejected', code: 'activity.source-mismatch' });
          }
          if (this.tombstones.has(a.id)) {
            return fail({ kind: 'gone' });
          }
          // Like the server's contentHash: the time zone is part of the content.
          const content = JSON.stringify([
            a.type,
            a.name,
            a.startedAt,
            a.endedAt,
            a.resumedSegments,
            meta.timeZone,
            trackHashInput(a.track),
          ]);
          const existing = this.activities.get(a.id);
          const stored = (version: number): StoredActivity => ({
            version,
            content,
            source: meta.source,
            timeZone: meta.timeZone,
            name: a.name,
            renamedAt: existing?.renamedAt ?? null,
            pointCount: a.track.length,
            trackHash: hashOf(trackHashInput(a.track)),
            gapRoutes: null, // a new track has no gap routes until they are sent again
            archive: { ...a, timeZone: meta.timeZone, gapRoutes: [], gapsCheckedAt: null },
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
          return a ? ok({ version: a.version, name: a.name, renamedAt: a.renamedAt }) : fail({ kind: 'not-found' });
        }),
      deleteActivity: (id) =>
        call('deleteActivity', { id }, () => {
          this.activities.delete(id);
          this.tombstones.add(id);
          return ok(undefined);
        }),
      renameActivity: (id, name, renamedAt) =>
        call('renameActivity', { id }, () => {
          if (!hasConsent('cloud-sync')) {
            return fail({ kind: 'consent' });
          }
          if (this.tombstones.has(id)) {
            return fail({ kind: 'gone' });
          }
          const a = this.activities.get(id);
          if (!a) {
            return fail({ kind: 'not-found' });
          }
          if (!name.trim() || name.length > 80) {
            return fail({ kind: 'rejected', code: 'activity.invalid-name' });
          }
          if (a.renamedAt != null && a.renamedAt >= renamedAt) {
            return ok({ version: a.version }); // older rename: unchanged
          }
          if (name === a.name) {
            // A newer rename to the same name only moves renamedAt (no new version).
            this.activities.set(id, { ...a, renamedAt, archive: a.archive && { ...a.archive, renamedAt } });
            return ok({ version: a.version });
          }
          const version = a.version + 1;
          this.activities.set(id, {
            ...a,
            version,
            name,
            renamedAt,
            archive: a.archive && { ...a.archive, name, renamedAt },
          });
          return ok({ version });
        }),
      activityCopy: (id) =>
        call('activityCopy', { id }, () => {
          if (this.tombstones.has(id)) {
            return fail({ kind: 'gone' });
          }
          const a = this.activities.get(id);
          if (!a?.archive) {
            return fail({ kind: 'not-found' });
          }
          // Through JSON, like the wire: the phone never shares objects with the server.
          const copy = JSON.parse(JSON.stringify(a.archive)) as ActivityArchive;
          return ok({ ...copy, version: a.version, source: a.source });
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
          this.activities.set(id, {
            ...a,
            version,
            gapRoutes: { checkedAt, count: routes.length },
            archive: a.archive && { ...a.archive, gapRoutes: routes.map((r) => ({ ...r })), gapsCheckedAt: checkedAt },
          });
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

/** Credentials of a signed-in account (Identity in the app), counting how often they are read. */
export class FakeAccountCredentials implements BackupCredentials {
  reads = 0;
  constructor(public value: { token: string; accountId: string | null } | null = null) {}
  async current() {
    this.reads++;
    return this.value;
  }
}

const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });
const fail = <T>(failure: ApiFailure): ApiResult<T> => ({ ok: false, failure });
