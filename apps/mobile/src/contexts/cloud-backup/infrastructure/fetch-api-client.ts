import type { ActivityArchive } from '@/contexts/activity-log';
import type { HomeCityChoice } from '@/contexts/territory';

import type {
  ApiClient,
  ApiClientFactory,
  ApiFailure,
  ApiResult,
  ChangesPage,
  ConsentPurpose,
  ServerAccess,
  ServerActivityCopy,
  ServerActivityHead,
  UploadSource,
} from '../application/ports';
import { canonicalTrackPoints } from '../domain/backup-policy';

export interface FetchApiClientOptions {
  /** `CityTurfer-Client` header, e.g. `ios/0.8.0`. */
  client: string;
  timeoutMs: number;
  uploadTimeoutMs: number;
  /** Injected in tests; the global fetch otherwise. */
  fetchImpl?: typeof fetch;
}

interface Answer {
  status: number;
  json: unknown;
  etag: string | null;
}

const CHANGES_PAGE_SIZE = 500;
const CODE_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;

const iso = (ms: number) => new Date(ms).toISOString();
/** ISO date-time → epoch ms; null when absent or not a date. */
const ms = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });
const fail = <T>(failure: ApiFailure): ApiResult<T> => ({ ok: false, failure });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isConsentPurpose = (v: unknown): v is ConsentPurpose => v === 'cloud-sync' || v === 'apple-health-in-cloud-sync';

/** `"v3"` (or W/"v3") → 3. */
function versionOfEtag(etag: string | null): number | null {
  const m = etag?.match(/"v(\d+)"/);
  return m ? Number(m[1]) : null;
}

function versionOf(a: Answer): number | null {
  if (isObject(a.json) && typeof a.json.version === 'number') {
    return a.json.version;
  }
  return versionOfEtag(a.etag);
}

/** A problem+json `code` from the server's catalogue; anything else becomes `http-<status>`. */
function problemCode(a: Answer): string {
  const code = isObject(a.json) ? a.json.code : null;
  return typeof code === 'string' && CODE_PATTERN.test(code) ? code : `http-${a.status}`;
}

/** HTTP → the backup's failure kinds. The only place that knows status codes. */
function failureOf(a: Answer | null): ApiFailure {
  if (!a) {
    return { kind: 'offline' };
  }
  switch (a.status) {
    case 401:
      return { kind: 'auth' };
    case 403:
      return { kind: 'consent' };
    case 404:
      return { kind: 'not-found' };
    case 409:
    case 410:
      return { kind: 'gone' };
    case 412:
    case 428:
      return { kind: 'precondition' };
    case 413:
      return { kind: 'too-large' };
    case 426:
      return { kind: 'outdated' };
    case 429:
      return { kind: 'unavailable', reason: 'busy' };
    case 501:
      return { kind: 'unavailable', reason: 'not-ready' };
    default:
      return a.status >= 500 ? { kind: 'unavailable', reason: 'server' } : { kind: 'rejected', code: problemCode(a) };
  }
}

/** The upload body of contract 0.4.0 (ActivityUpload). Track points: [lon, lat, t, segment, altM|null]. */
export function uploadBody(a: ActivityArchive, meta: { source: UploadSource; timeZone: string | null }) {
  return {
    type: a.type,
    name: a.name,
    source: meta.source,
    startedAt: iso(a.startedAt),
    endedAt: iso(a.endedAt),
    ...(meta.timeZone ? { timeZone: meta.timeZone } : {}),
    resumedSegments: a.resumedSegments,
    track: { points: canonicalTrackPoints(a.track) },
  };
}

type Points = [number, number, number, number, number | null][];

function isPoints(v: unknown): v is Points {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 4 &&
        isNumber(p[0]) &&
        isNumber(p[1]) &&
        isNumber(p[2]) &&
        Number.isInteger(p[3]) &&
        (p[4] == null || isNumber(p[4]))
    )
  );
}

/** GET /v1/activities/{id} (ActivityDetail) + …/track → the server copy, or null when malformed. */
export function serverCopyOf(detail: unknown, track: unknown): ServerActivityCopy | null {
  if (!isObject(detail) || !isObject(track) || !isPoints(track.points)) {
    return null;
  }
  const { id, type, name, version } = detail;
  const startedAt = ms(detail.startedAt);
  const endedAt = ms(detail.endedAt);
  if (
    typeof id !== 'string' ||
    (type !== 'walk' && type !== 'run' && type !== 'cycle') ||
    typeof name !== 'string' ||
    !isNumber(version) ||
    startedAt == null ||
    endedAt == null
  ) {
    return null;
  }
  const resumed = detail.resumedSegments;
  const routes = Array.isArray(detail.gapRoutes) ? detail.gapRoutes : [];
  return {
    id,
    type,
    name,
    version,
    source: detail.source === 'apple-health' ? 'apple-health' : 'recording',
    startedAt,
    endedAt,
    timeZone: typeof detail.timeZone === 'string' ? detail.timeZone : null,
    renamedAt: ms(detail.renamedAt),
    resumedSegments: Array.isArray(resumed) && resumed.every(Number.isInteger) ? (resumed as number[]) : null,
    track: track.points.map(([lon, lat, t, segment, alt]) => ({
      lon,
      lat,
      t,
      segment,
      alt: alt ?? null,
      accuracy: null,
      speed: null,
    })),
    gapRoutes: routes.filter(isObject).flatMap((r) =>
      Number.isInteger(r.afterSegment) && isNumber(r.distanceM) && isNumber(r.movingS) && Array.isArray(r.coords)
        ? [
            {
              afterSegment: r.afterSegment as number,
              distanceM: r.distanceM,
              movingS: r.movingS,
              coords: (r.coords as unknown[]).filter(
                (c): c is [number, number] => Array.isArray(c) && isNumber(c[0]) && isNumber(c[1])
              ),
            },
          ]
        : []
    ),
    gapsCheckedAt: ms(detail.gapsCheckedAt),
  };
}

/**
 * The CityTurfer API over fetch: bearer token, JSON. Bodies are sent uncompressed: gzip would need a
 * native module or a new dependency (Hermes has no CompressionStream), and a track at the 40,000-point
 * limit is about 2 MB, under Vercel's 4.5 MB. Never logs: requests carry the token and coordinates.
 */
class FetchApiClient implements ApiClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly access: ServerAccess,
    private readonly opts: FetchApiClientOptions
  ) {
    this.base = access.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
  }

  async me(): Promise<ApiResult<{ id: string }>> {
    const a = await this.request('GET', '/v1/me');
    if (a?.status !== 200) {
      return fail(failureOf(a));
    }
    return isObject(a.json) && typeof a.json.id === 'string'
      ? ok({ id: a.json.id })
      : fail({ kind: 'unavailable', reason: 'server' });
  }

  async setConsent(purpose: ConsentPurpose, granted: boolean, policyVersion: string): Promise<ApiResult<void>> {
    const a = await this.request('PUT', `/v1/me/consents/${purpose}`, { body: { granted, policyVersion } });
    return a?.status === 200 || a?.status === 204 ? ok(undefined) : fail(failureOf(a));
  }

  async consents(): Promise<ApiResult<{ purpose: ConsentPurpose; granted: boolean }[]>> {
    const a = await this.request('GET', '/v1/me/consents');
    if (a?.status !== 200) {
      return fail(failureOf(a));
    }
    if (!isObject(a.json) || !Array.isArray(a.json.items)) {
      return fail({ kind: 'unavailable', reason: 'server' });
    }
    return ok(
      (a.json.items as unknown[]).flatMap((c) =>
        isObject(c) && isConsentPurpose(c.purpose) && typeof c.granted === 'boolean'
          ? [{ purpose: c.purpose, granted: c.granted }]
          : []
      )
    );
  }

  async changes(cursor: string | null): Promise<ApiResult<ChangesPage>> {
    const query = `limit=${CHANGES_PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const a = await this.request('GET', `/v1/sync/changes?${query}`);
    if (a?.status !== 200) {
      return fail(failureOf(a));
    }
    const body = a.json;
    if (!isObject(body) || !Array.isArray(body.changes) || typeof body.nextCursor !== 'string') {
      return fail({ kind: 'unavailable', reason: 'server' });
    }
    const page: ChangesPage = {
      upserted: [],
      deleted: [],
      homeCity: null,
      nextCursor: body.nextCursor,
      hasMore: body.hasMore === true,
    };
    for (const c of body.changes as unknown[]) {
      if (!isObject(c)) {
        continue;
      }
      const activity = c.activity;
      if (c.type === 'activity.upserted' && isObject(activity) && typeof activity.id === 'string') {
        page.upserted.push({
          id: activity.id,
          version: isNumber(activity.version) ? activity.version : 0,
          startedAt: ms(activity.startedAt) ?? 0,
          name: typeof activity.name === 'string' ? activity.name : '',
          trackHash: typeof activity.trackHash === 'string' ? activity.trackHash : '',
        });
      } else if (c.type === 'activity.deleted' && typeof c.activityId === 'string') {
        page.deleted.push(c.activityId);
      } else if (c.type === 'home-city.chosen' && (typeof c.cityId === 'string' || c.cityId === null)) {
        const chosenAt = ms(c.chosenAt);
        if (chosenAt != null) {
          page.homeCity = { cityId: c.cityId, chosenAt };
        }
      }
    }
    return ok(page);
  }

  async putActivity(
    activity: ActivityArchive,
    meta: { source: UploadSource; timeZone: string | null },
    ifMatchVersion: number | null
  ): Promise<ApiResult<{ version: number }>> {
    const a = await this.request('PUT', `/v1/activities/${encodeURIComponent(activity.id)}`, {
      body: uploadBody(activity, meta),
      headers: ifMatchVersion != null ? { 'If-Match': `"v${ifMatchVersion}"` } : {},
      timeoutMs: this.opts.uploadTimeoutMs,
    });
    return this.versioned(a);
  }

  async activityVersion(activityId: string): Promise<ApiResult<ServerActivityHead>> {
    const a = await this.request('GET', `/v1/activities/${encodeURIComponent(activityId)}`);
    const r = this.versioned(a);
    if (!r.ok) {
      return r;
    }
    const json = isObject(a?.json) ? a.json : {};
    return ok({
      version: r.value.version,
      name: typeof json.name === 'string' ? json.name : null,
      renamedAt: ms(json.renamedAt),
    });
  }

  async deleteActivity(activityId: string): Promise<ApiResult<void>> {
    const a = await this.request('DELETE', `/v1/activities/${encodeURIComponent(activityId)}`);
    return a && a.status >= 200 && a.status < 300 ? ok(undefined) : fail(failureOf(a));
  }

  async renameActivity(
    activityId: string,
    name: string,
    renamedAt: number
  ): Promise<ApiResult<{ version: number | null }>> {
    const a = await this.request('PATCH', `/v1/activities/${encodeURIComponent(activityId)}`, {
      body: { name, renamedAt: iso(renamedAt) },
    });
    return a?.status === 200 ? ok({ version: versionOf(a) }) : fail(failureOf(a));
  }

  async activityCopy(activityId: string): Promise<ApiResult<ServerActivityCopy>> {
    const path = `/v1/activities/${encodeURIComponent(activityId)}`;
    const detail = await this.request('GET', path);
    if (detail?.status !== 200) {
      return fail(failureOf(detail));
    }
    const track = await this.request('GET', `${path}/track`, { timeoutMs: this.opts.uploadTimeoutMs });
    if (track?.status !== 200) {
      return fail(failureOf(track));
    }
    const copy = serverCopyOf(detail.json, track.json);
    return copy ? ok(copy) : fail({ kind: 'rejected', code: 'restore.malformed' });
  }

  async putGapRoutes(
    activityId: string,
    checkedAt: number,
    routes: ActivityArchive['gapRoutes']
  ): Promise<ApiResult<{ version: number | null }>> {
    const a = await this.request('PUT', `/v1/activities/${encodeURIComponent(activityId)}/gap-routes`, {
      body: { checkedAt: iso(checkedAt), routes },
      timeoutMs: this.opts.uploadTimeoutMs,
    });
    return a?.status === 200 ? ok({ version: versionOf(a) }) : fail(failureOf(a));
  }

  async putHomeCity(choice: HomeCityChoice): Promise<ApiResult<void>> {
    const a = await this.request('PUT', '/v1/turf/home-city', {
      body: { cityId: choice.cityId, chosenAt: iso(choice.chosenAt) },
    });
    return a?.status === 200 ? ok(undefined) : fail(failureOf(a));
  }

  private versioned(a: Answer | null): ApiResult<{ version: number }> {
    if (!a || (a.status !== 200 && a.status !== 201)) {
      return fail(failureOf(a));
    }
    const version = versionOf(a);
    return version != null ? ok({ version }) : fail({ kind: 'unavailable', reason: 'server' });
  }

  /** Null when there was no answer (offline, DNS, timeout). */
  private async request(
    method: string,
    path: string,
    o: { body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {}
  ): Promise<Answer | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), o.timeoutMs ?? this.opts.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.access.token}`,
          'CityTurfer-Client': this.opts.client,
          ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...o.headers,
        },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json, etag: res.headers.get('ETag') };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const createFetchApiClient =
  (opts: FetchApiClientOptions): ApiClientFactory =>
  (access) =>
    new FetchApiClient(access, opts);
