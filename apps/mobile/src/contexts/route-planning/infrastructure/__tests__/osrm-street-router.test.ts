import { OSM_ROUTING_PROJECT_URL } from '@/constants/routing';
import { OSM_ROUTER_OFFLINE_PAUSE_MS as OFFLINE_PAUSE_MS } from '@/platform/osm-router-gate';

import { OsrmStreetRouter } from '../osrm-street-router';
import { BUDGET_WINDOW_MS, MAX_REQUESTS_PER_WINDOW } from '../street-router-budget';

// Synthetic Waypoints in Gdańsk with more decimals than may leave the phone.
const W = [
  { lat: 54.3520123456, lon: 18.6466384321 },
  { lat: 54.35587, lon: 18.65311 },
  { lat: 54.34961, lon: 18.65702 },
];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** An OSRM answer with steps=true: each leg's path split over steps that share their joints. */
const OK = {
  code: 'Ok',
  routes: [
    {
      legs: [
        {
          steps: [
            {
              geometry: {
                coordinates: [
                  [18.6466, 54.352],
                  [18.65, 54.353],
                ],
              },
            },
            {
              geometry: {
                coordinates: [
                  [18.65, 54.353],
                  [18.6531, 54.3559],
                ],
              },
            },
            {
              geometry: {
                coordinates: [
                  [18.6531, 54.3559],
                  [18.6531, 54.3559],
                ],
              },
            }, // arrive
          ],
        },
        { steps: [{ geometry: { coordinates: [[18.6531, 54.3559]] } }] },
      ],
    },
  ],
};

function router(respond: (url: string, init?: RequestInit) => Promise<Response>, o: { timeoutMs?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const waits: number[] = [];
  let now = 0;
  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  }) as typeof fetch;
  const r = new OsrmStreetRouter({
    appVersion: '0.17.0',
    fetch: fetchStub,
    timeoutMs: o.timeoutMs,
    now: () => now,
    wait: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });
  return { r, calls, waits, advance: (ms: number) => void (now += ms) };
}

describe('OsrmStreetRouter', () => {
  it('asks once through every Waypoint, lon,lat rounded to 4 decimals, with the type profile', async () => {
    const t = router(async () => json(OK));
    await t.r.route(W, 'walk');
    t.advance(1000);
    await t.r.route(W.slice(0, 2), 'cycle');
    expect(t.calls.map((c) => c.url)).toEqual([
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/18.6466,54.3520;18.6531,54.3559;18.6570,54.3496?overview=false&steps=true&geometries=geojson',
      'https://routing.openstreetmap.de/routed-bike/route/v1/driving/18.6466,54.3520;18.6531,54.3559?overview=false&steps=true&geometries=geojson',
    ]);
    for (const c of t.calls) {
      expect(c.url).not.toMatch(/\d\.\d{5}/);
    }
  });

  it('identifies the app as the usage policy asks, without personal data', async () => {
    const t = router(async () => json(OK));
    await t.r.route(W, 'run');
    const headers = t.calls[0].init!.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(`CityTurfer/0.17.0 (+${OSM_ROUTING_PROJECT_URL})`);
    expect(headers.Referer).toBe(OSM_ROUTING_PROJECT_URL);
    expect(JSON.stringify(headers)).not.toMatch(/@/);
  });

  it("joins each leg's steps into one path, without repeating shared points", async () => {
    const t = router(async () => json(OK));
    expect(await t.r.route(W, 'walk')).toEqual({
      kind: 'routed',
      legs: [
        [
          { lat: 54.352, lon: 18.6466 },
          { lat: 54.353, lon: 18.65 },
          { lat: 54.3559, lon: 18.6531 },
        ],
        [
          { lat: 54.3559, lon: 18.6531 },
          { lat: 54.3559, lon: 18.6531 },
        ],
      ],
    });
  });

  it('no route for a 400, a code other than Ok or no routes; never asks for fewer than two Waypoints', async () => {
    expect(await router(async () => json({ code: 'InvalidQuery' }, 400)).r.route(W, 'walk')).toEqual({
      kind: 'no-route',
    });
    expect(await router(async () => json({ code: 'NoRoute', routes: [] })).r.route(W, 'walk')).toEqual({
      kind: 'no-route',
    });
    expect(await router(async () => json({ code: 'Ok', routes: [] })).r.route(W, 'walk')).toEqual({
      kind: 'no-route',
    });
    const one = router(async () => json(OK));
    expect(await one.r.route(W.slice(0, 1), 'walk')).toEqual({ kind: 'no-route' });
    expect(one.calls).toEqual([]);
  });

  it('a bad answer (legs missing, broken geometry, not JSON, 5xx) is unavailable, never a throw', async () => {
    const bad = [
      json({ code: 'Ok', routes: [{ legs: [OK.routes[0].legs[0]] }] }),
      json({
        code: 'Ok',
        routes: [{ legs: [{ steps: [{ geometry: { coordinates: [['x', 1]] } }] }, OK.routes[0].legs[1]] }],
      }),
      json({ code: 'Ok', routes: [{ legs: [{ steps: [] }, OK.routes[0].legs[1]] }] }),
      new Response('<html>', { status: 200 }),
      json({}, 503),
    ];
    for (const res of bad) {
      expect(await router(async () => res).r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'failed' });
    }
  });

  it('429: rate limited, and nothing is sent until Retry-After has passed', async () => {
    const t = router(async () => json({}, 429, { 'Retry-After': '120' }));
    expect(await t.r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'rate-limited' });
    t.advance(119_000);
    expect(await t.r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'budget' });
    expect(t.calls).toHaveLength(1);
    t.advance(1_000);
    await t.r.route(W, 'walk');
    expect(t.calls).toHaveLength(2);
  });

  it('offline: unavailable, and a short pause before asking again', async () => {
    const t = router(async () => {
      throw new TypeError('Network request failed');
    });
    expect(await t.r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'offline' });
    expect(await t.r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'budget' });
    t.advance(OFFLINE_PAUSE_MS);
    await t.r.route(W, 'walk');
    expect(t.calls).toHaveLength(2);
  });

  it('aborts a request slower than the timeout', async () => {
    let signal: AbortSignal | undefined;
    const t = router(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      { timeoutMs: 20 }
    );
    expect(await t.r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'timeout' });
    expect(signal?.aborted).toBe(true);
  });

  it('paces requests a second apart and stops at the budget of the window', async () => {
    const t = router(async () => json(OK));
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect((await t.r.route(W, 'walk')).kind).toBe('routed');
    }
    expect(t.waits).toEqual(Array(MAX_REQUESTS_PER_WINDOW - 1).fill(1000));
    expect(await t.r.route(W, 'walk')).toEqual({ kind: 'unavailable', reason: 'budget' });
    expect(t.calls).toHaveLength(MAX_REQUESTS_PER_WINDOW);
    t.advance(BUDGET_WINDOW_MS);
    expect((await t.r.route(W, 'walk')).kind).toBe('routed');
  });
});
