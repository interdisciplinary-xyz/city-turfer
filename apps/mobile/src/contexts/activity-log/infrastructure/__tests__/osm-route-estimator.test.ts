import { RouterRateLimited, RouterUnreachable } from '../../application/use-cases';
import { OsmRouteEstimator, PROJECT_URL } from '../osm-route-estimator';

const FROM = { lat: 52.2297123456, lon: 21.0122287654 };
const TO = { lat: 52.23519, lon: 21.00848 };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function estimator(respond: (url: string, init?: RequestInit) => Promise<Response>, timeoutMs?: number) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  }) as typeof fetch;
  return { calls, r: new OsmRouteEstimator({ appVersion: '0.2.0', fetch: fetchStub, timeoutMs, now: () => 0 }) };
}

const OK = {
  code: 'Ok',
  routes: [
    {
      distance: 812.4,
      geometry: {
        coordinates: [
          [21.0122, 52.2297],
          [21.0085, 52.2352],
        ],
      },
    },
  ],
};

describe('OsmRouteEstimator', () => {
  it('asks for lon,lat pairs rounded to 4 decimals, with the profile of the activity type', async () => {
    const { calls, r } = estimator(async () => json(OK));
    await r.route(FROM, TO, 'walk');
    await r.route(FROM, TO, 'run');
    await r.route(FROM, TO, 'cycle');
    expect(calls.map((c) => c.url)).toEqual([
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/21.0122,52.2297;21.0085,52.2352?overview=full&geometries=geojson',
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/21.0122,52.2297;21.0085,52.2352?overview=full&geometries=geojson',
      'https://routing.openstreetmap.de/routed-bike/route/v1/driving/21.0122,52.2297;21.0085,52.2352?overview=full&geometries=geojson',
    ]);
    // Nothing more precise than 4 decimals ever leaves the phone.
    for (const c of calls) expect(c.url).not.toMatch(/\d\.\d{5}/);
  });

  it('identifies the app as the FOSSGIS usage policy asks, without personal data', async () => {
    const { calls, r } = estimator(async () => json(OK));
    await r.route(FROM, TO, 'walk');
    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(`CityTurfer/0.2.0 (+${PROJECT_URL})`);
    expect(headers.Referer).toBe(PROJECT_URL);
    expect(JSON.stringify(headers)).not.toMatch(/@/);
  });

  it('returns the distance and geometry of the first route', async () => {
    const { r } = estimator(async () => json(OK));
    expect(await r.route(FROM, TO, 'walk')).toEqual({ distanceM: 812.4, coords: OK.routes[0].geometry.coordinates });
  });

  it('resolves null for 400 (not routable), a code other than Ok, or no routes', async () => {
    expect(await estimator(async () => json({ code: 'InvalidQuery' }, 400)).r.route(FROM, TO, 'walk')).toBeNull();
    expect(await estimator(async () => json({ code: 'NoRoute', routes: [] })).r.route(FROM, TO, 'walk')).toBeNull();
    expect(await estimator(async () => json({ code: 'Ok', routes: [] })).r.route(FROM, TO, 'walk')).toBeNull();
    expect(await estimator(async () => json({ code: 'Ok' })).r.route(FROM, TO, 'walk')).toBeNull();
  });

  it('throws on server errors (that gap failed; retried later)', async () => {
    const { r } = estimator(async () => json({}, 500));
    await expect(r.route(FROM, TO, 'walk')).rejects.toThrow('router 500');
    await expect(r.route(FROM, TO, 'walk')).rejects.not.toBeInstanceOf(RouterUnreachable);
  });

  it('honours 429 with Retry-After in seconds or as an HTTP date', async () => {
    const secs = estimator(async () => json({}, 429, { 'Retry-After': '120' }));
    await expect(secs.r.route(FROM, TO, 'walk')).rejects.toEqual(new RouterRateLimited(120_000));
    const date = estimator(async () => json({}, 429, { 'Retry-After': new Date(30_000).toUTCString() }));
    const e = await date.r.route(FROM, TO, 'walk').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RouterRateLimited);
    expect((e as RouterRateLimited).retryAfterMs).toBe(30_000);
    const none = estimator(async () => json({}, 429));
    expect(((await none.r.route(FROM, TO, 'walk').catch((x: unknown) => x)) as RouterRateLimited).retryAfterMs).toBe(
      null
    );
  });

  it('reports a network failure as unreachable (offline)', async () => {
    const { r } = estimator(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(r.route(FROM, TO, 'walk')).rejects.toBeInstanceOf(RouterUnreachable);
  });

  it('aborts a request that takes longer than the timeout', async () => {
    let signal: AbortSignal | undefined;
    const { r } = estimator(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      20
    );
    const e = await r.route(FROM, TO, 'walk').catch((x: unknown) => x);
    expect(signal?.aborted).toBe(true);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(RouterUnreachable); // slow service: a per-activity failure, not "offline"
    expect((e as Error).message).toBe('router timeout');
  });
});
