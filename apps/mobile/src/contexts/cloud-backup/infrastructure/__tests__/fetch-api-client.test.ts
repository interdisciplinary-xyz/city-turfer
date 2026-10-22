import type { ActivityArchive } from '@/contexts/activity-log';

import { createFetchApiClient } from '../fetch-api-client';

const T0 = Date.parse('2026-10-19T07:12:00Z');

const archive: ActivityArchive = {
  id: 'rec-1',
  type: 'run',
  name: 'Morning run',
  startedAt: T0,
  endedAt: T0 + 10_000,
  resumedSegments: [1],
  track: [
    { lat: 52.2297, lon: 21.0122, t: T0, segment: 0, alt: 98.5, accuracy: 4, speed: 3 },
    { lat: 52.2299, lon: 21.0125, t: T0 + 10_000, segment: 1, alt: null, accuracy: 6, speed: null },
  ],
  gapRoutes: [],
  gapsCheckedAt: null,
  timeZone: 'Europe/Warsaw',
  renamedAt: null,
};

interface Call {
  url: string;
  init: RequestInit;
}

function setup(answer: (call: Call) => { status: number; body?: unknown; etag?: string } | Error) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const a = answer(call);
    if (a instanceof Error) {
      throw a;
    }
    return {
      status: a.status,
      text: async () => (a.body === undefined ? '' : JSON.stringify(a.body)),
      headers: { get: (h: string) => (h === 'ETag' ? (a.etag ?? null) : null) },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  const api = createFetchApiClient({ client: 'ios/0.8.0', timeoutMs: 1_000, uploadTimeoutMs: 2_000, fetchImpl })({
    baseUrl: 'https://api.example.org/',
    token: 'tok-123',
  });
  return { api, calls };
}

const headers = (c: Call) => c.init.headers as Record<string, string>;
const body = (c: Call) => JSON.parse(c.init.body as string);

describe('FetchApiClient', () => {
  it('uploads the contract body: ISO times, 5-column points, no accuracy, speed or trackHash', async () => {
    const { api, calls } = setup(() => ({ status: 201, body: { version: 1 }, etag: '"v1"' }));
    const r = await api.putActivity(archive, { source: 'recording', timeZone: 'Europe/Warsaw' }, null);
    expect(r).toEqual({ ok: true, value: { version: 1 } });
    const [c] = calls;
    expect(c.url).toBe('https://api.example.org/v1/activities/rec-1');
    expect(c.init.method).toBe('PUT');
    expect(headers(c)).toMatchObject({
      Authorization: 'Bearer tok-123',
      'Content-Type': 'application/json',
      'CityTurfer-Client': 'ios/0.8.0',
    });
    expect(headers(c)['If-Match']).toBeUndefined();
    expect(body(c)).toEqual({
      type: 'run',
      name: 'Morning run',
      source: 'recording',
      startedAt: '2026-10-19T07:12:00.000Z',
      endedAt: '2026-10-19T07:12:10.000Z',
      timeZone: 'Europe/Warsaw',
      resumedSegments: [1],
      track: {
        points: [
          [21.0122, 52.2297, T0, 0, 98.5],
          [21.0125, 52.2299, T0 + 10_000, 1, null],
        ],
      },
    });
  });

  it('replaces with If-Match and reads the version from the ETag when the body has none', async () => {
    const { api, calls } = setup(() => ({ status: 200, etag: '"v4"' }));
    expect(await api.putActivity(archive, { source: 'apple-health', timeZone: null }, 3)).toEqual({
      ok: true,
      value: { version: 4 },
    });
    expect(headers(calls[0])['If-Match']).toBe('"v3"');
    expect(body(calls[0]).timeZone).toBeUndefined();
    expect(body(calls[0]).source).toBe('apple-health');
  });

  it.each([
    [401, { kind: 'auth' }],
    [403, { kind: 'consent' }],
    [404, { kind: 'not-found' }],
    [409, { kind: 'gone' }],
    [410, { kind: 'gone' }],
    [412, { kind: 'precondition' }],
    [428, { kind: 'precondition' }],
    [413, { kind: 'too-large' }],
    [426, { kind: 'outdated' }],
    [429, { kind: 'unavailable', reason: 'busy' }],
    [500, { kind: 'unavailable', reason: 'server' }],
    [501, { kind: 'unavailable', reason: 'not-ready' }],
    [422, { kind: 'rejected', code: 'activity.track-too-short' }],
  ])('maps HTTP %i to %o', async (status, failure) => {
    const { api } = setup(() => ({ status, body: { code: 'activity.track-too-short', status } }));
    expect(await api.putActivity(archive, { source: 'recording', timeZone: null }, null)).toEqual({
      ok: false,
      failure,
    });
  });

  it('never trusts a code that is not from the catalogue format', async () => {
    const { api } = setup(() => ({ status: 400, body: { code: 'Bad <script> 52.2297,21.0122' } }));
    expect(await api.deleteActivity('x')).toEqual({ ok: false, failure: { kind: 'rejected', code: 'http-400' } });
  });

  it('no answer (network error, timeout) is "offline"', async () => {
    const { api } = setup(() => new TypeError('Network request failed'));
    expect(await api.changes(null)).toEqual({ ok: false, failure: { kind: 'offline' } });
  });

  it('reads the changes feed: upserts with versions, tombstones; ignores Home City changes', async () => {
    const { api, calls } = setup(() => ({
      status: 200,
      body: {
        changes: [
          { type: 'activity.upserted', changedAt: 'x', activity: { id: 'a', version: 3 } },
          { type: 'activity.deleted', changedAt: 'x', activityId: 'b', deletedAt: 'x' },
          { type: 'home-city.chosen', changedAt: 'x', cityId: 'pl-krakow', chosenAt: 'x' },
        ],
        nextCursor: 'c/2',
        hasMore: true,
      },
    }));
    expect(await api.changes('c/1')).toEqual({
      ok: true,
      value: { upserted: [{ id: 'a', version: 3 }], deleted: ['b'], nextCursor: 'c/2', hasMore: true },
    });
    expect(calls[0].url).toBe('https://api.example.org/v1/sync/changes?limit=500&cursor=c%2F1');
    expect(calls[0].init.method).toBe('GET');
  });

  it('sends consents, deletes, gap routes and the Home City as the contract says', async () => {
    const { api, calls } = setup((c) => ({ status: c.init.method === 'DELETE' ? 204 : 200, body: { version: 2 } }));
    await api.setConsent('apple-health-in-cloud-sync', false, '2026-10');
    await api.deleteActivity('hk-1');
    await api.putGapRoutes('rec-1', T0, [
      {
        afterSegment: 0,
        distanceM: 240,
        movingS: 85,
        coords: [
          [21.0129, 52.2301],
          [21.0141, 52.2307],
        ],
      },
    ]);
    await api.putHomeCity({ cityId: 'pl-krakow', chosenAt: T0 });
    expect(calls.map((c) => `${c.init.method} ${c.url.replace('https://api.example.org', '')}`)).toEqual([
      'PUT /v1/me/consents/apple-health-in-cloud-sync',
      'DELETE /v1/activities/hk-1',
      'PUT /v1/activities/rec-1/gap-routes',
      'PUT /v1/turf/home-city',
    ]);
    expect(body(calls[0])).toEqual({ granted: false, policyVersion: '2026-10' });
    expect(calls[1].init.body).toBeUndefined();
    expect(body(calls[2])).toEqual({
      checkedAt: '2026-10-19T07:12:00.000Z',
      routes: [
        {
          afterSegment: 0,
          distanceM: 240,
          movingS: 85,
          coords: [
            [21.0129, 52.2301],
            [21.0141, 52.2307],
          ],
        },
      ],
    });
    expect(body(calls[3])).toEqual({ cityId: 'pl-krakow', chosenAt: '2026-10-19T07:12:00.000Z' });
  });
});
