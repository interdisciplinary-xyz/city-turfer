import { RouterRateLimited, RouterUnreachable } from '@cityturfer/core/activity-log';

import { OsmRouteEstimator } from '@/contexts/activity-log/infrastructure/osm-route-estimator';
import { OsrmStreetRouter } from '@/contexts/route-planning/infrastructure/osrm-street-router';

import {
  OSM_ROUTER_MIN_INTERVAL_MS,
  OSM_ROUTER_OFFLINE_PAUSE_MS,
  OsmRouterGate,
  retryAfterMs,
} from '../osm-router-gate';

// Synthetic points in Gdańsk (no real user data).
const P = { lat: 54.352, lon: 18.6466 };
const Q = { lat: 54.3559, lon: 18.6531 };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const GAP_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 500,
      geometry: {
        coordinates: [
          [P.lon, P.lat],
          [Q.lon, Q.lat],
        ],
      },
    },
  ],
};
const SNAP_OK = {
  code: 'Ok',
  routes: [
    {
      legs: [
        {
          steps: [
            {
              geometry: {
                coordinates: [
                  [P.lon, P.lat],
                  [Q.lon, Q.lat],
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

/** Both features' adapters over one gate and one fake clock; `sentAt` is when each request left. */
function app(respond: (url: string) => Response | Promise<Response>) {
  let now = 0;
  const sentAt: { feature: 'gaps' | 'snap'; at: number }[] = [];
  const fetchStub = (async (input: RequestInfo | URL) => {
    const url = String(input);
    sentAt.push({ feature: url.includes('steps=true') ? 'snap' : 'gaps', at: now });
    return respond(url);
  }) as typeof fetch;
  const clock = () => now;
  const gate = new OsmRouterGate(clock, async (ms) => {
    now += ms;
  });
  return {
    gaps: new OsmRouteEstimator({ appVersion: '0.17.0', fetch: fetchStub, now: clock, gate }),
    snap: new OsrmStreetRouter({ appVersion: '0.17.0', fetch: fetchStub, now: clock, gate }),
    sentAt,
    advance: (ms: number) => void (now += ms),
  };
}

const answer = (url: string) => json(url.includes('steps=true') ? SNAP_OK : GAP_OK);

describe('OsmRouterGate: one gate for the shared OSM router', () => {
  it('two features never send within a second of each other, one after the other or at once', async () => {
    jest.useFakeTimers({ now: 0 }); // real setTimeout waits and Date.now, on a fake clock
    try {
      const sentAt: { feature: string; at: number }[] = [];
      const fetchStub = (async (input: RequestInfo | URL) => {
        const url = String(input);
        sentAt.push({ feature: url.includes('steps=true') ? 'snap' : 'gaps', at: Date.now() });
        return answer(url);
      }) as typeof fetch;
      const gate = new OsmRouterGate(); // as the composition root makes it
      const gaps = new OsmRouteEstimator({ appVersion: '0.17.0', fetch: fetchStub, gate });
      const snap = new OsrmStreetRouter({ appVersion: '0.17.0', fetch: fetchStub, gate });

      const all = (async () => {
        await gaps.route(P, Q, 'walk');
        await snap.route([P, Q], 'walk');
        await Promise.all([gaps.route(P, Q, 'walk'), snap.route([P, Q], 'walk'), gaps.route(P, Q, 'run')]);
      })();
      await jest.advanceTimersByTimeAsync(10_000);
      await all;

      expect(sentAt.map((s) => s.feature)).toEqual(['gaps', 'snap', 'gaps', 'snap', 'gaps']);
      for (let i = 1; i < sentAt.length; i++) {
        expect(sentAt[i].at - sentAt[i - 1].at).toBeGreaterThanOrEqual(OSM_ROUTER_MIN_INTERVAL_MS);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('a 429 seen by gap estimates pauses street snapping until Retry-After', async () => {
    let limited = true;
    const t = app((url) => (limited ? json({}, 429, { 'Retry-After': '120' }) : answer(url)));
    await expect(t.gaps.route(P, Q, 'walk')).rejects.toBeInstanceOf(RouterRateLimited);
    limited = false;
    expect(await t.snap.route([P, Q], 'walk')).toEqual({ kind: 'unavailable', reason: 'budget' });
    expect(t.sentAt).toHaveLength(1);
    t.advance(120_000);
    expect((await t.snap.route([P, Q], 'walk')).kind).toBe('routed');
    expect(t.sentAt).toHaveLength(2);
  });

  it('a 429 seen by street snapping pauses gap estimates, which wait out what is left of it', async () => {
    let limited = true;
    const t = app((url) => (limited ? json({}, 429, { 'Retry-After': '120' }) : answer(url)));
    expect(await t.snap.route([P, Q], 'walk')).toEqual({ kind: 'unavailable', reason: 'rate-limited' });
    limited = false;
    t.advance(20_000);
    const paused = await t.gaps.route(P, Q, 'walk').catch((e: unknown) => e);
    expect(paused).toBeInstanceOf(RouterRateLimited);
    expect((paused as RouterRateLimited).retryAfterMs).toBe(100_000);
    expect(t.sentAt).toHaveLength(1);
    t.advance(100_000);
    expect(await t.gaps.route(P, Q, 'walk')).toMatchObject({ distanceM: 500 });
  });

  it('offline in one feature pauses the other briefly', async () => {
    let online = false;
    const t = app((url) => {
      if (!online) {
        throw new TypeError('Network request failed');
      }
      return answer(url);
    });
    await expect(t.gaps.route(P, Q, 'walk')).rejects.toBeInstanceOf(RouterUnreachable);
    online = true;
    expect(await t.snap.route([P, Q], 'walk')).toEqual({ kind: 'unavailable', reason: 'budget' });
    t.advance(OSM_ROUTER_OFFLINE_PAUSE_MS);
    expect((await t.snap.route([P, Q], 'walk')).kind).toBe('routed');
    expect(t.sentAt).toHaveLength(2);
  });

  it('a pause that starts while a caller waits for its turn holds that caller back too', async () => {
    let now = 0;
    const gate = new OsmRouterGate(
      () => now,
      async (ms) => {
        gate.rateLimited(30_000); // the other feature hears a 429 meanwhile
        now += ms;
      }
    );
    expect(await gate.acquire()).toEqual({ go: true });
    expect(await gate.acquire()).toEqual({ go: false, pausedMs: 29_000 });
  });

  it('reads Retry-After as seconds or an HTTP date', () => {
    expect(retryAfterMs('120', 0)).toBe(120_000);
    expect(retryAfterMs(null, 0)).toBeNull();
    expect(retryAfterMs('soon', 0)).toBeNull();
    const at = Date.parse('Wed, 25 Nov 2026 10:00:30 GMT');
    expect(retryAfterMs('Wed, 25 Nov 2026 10:00:30 GMT', at - 30_000)).toBe(30_000);
  });
});
