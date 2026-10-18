import type { ActivityType, GeoPoint, TrackPoint } from '@/shared-kernel';

import { InMemoryActivityRepository } from '../../test-support/in-memory-activity-repository';
import {
  MAX_REQUESTS_PER_RUN,
  MIN_REQUEST_INTERVAL_MS,
  OFFLINE_RETRY_MS,
  RouterBudget,
  RUN_COOLDOWN_MS,
} from '../router-budget';
import {
  type ActivityLogDeps,
  CapEstimatedMovingTime,
  EstimateGapRoutes,
  ImportActivity,
  RecordActivityFromSession,
  RouterRateLimited,
  RouterUnreachable,
} from '../use-cases';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const M_PER_DEG_LAT = 111_195;

/** A run going north at ~3 m/s with a 200 s GPS outage (or pause) after every kilometre. */
function brokenRun(breaks: number, startS = 0): TrackPoint[] {
  const pts: TrackPoint[] = [];
  let north = 0;
  let s = startS;
  for (let seg = 0; seg <= breaks; seg++) {
    for (let i = 0; i <= 10; i++) {
      pts.push({
        lat: 52.2 + north / M_PER_DEG_LAT,
        lon: 21,
        t: T0 + s * 1000,
        segment: seg,
        alt: null,
        accuracy: 5,
        speed: 3,
      });
      north += 100;
      s += 33;
    }
    north += 300; // the outage: 300 m more along the street…
    s += 200; // …in 200 s
  }
  return pts;
}

type RouteFn = (
  from: GeoPoint,
  to: GeoPoint,
  type: ActivityType
) => Promise<{ distanceM: number; coords: [number, number][] } | null>;

/** A street route 1.2× the straight line. */
const straightish: RouteFn = async (from, to) => {
  const d = Math.abs(to.lat - from.lat) * M_PER_DEG_LAT * 1.2;
  return {
    distanceM: d,
    coords: [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ],
  };
};

function setup(route: RouteFn = straightish) {
  let now = T0 + 86_400_000;
  let enabled = true;
  let foreground = true;
  const waits: number[] = [];
  const calls: { from: GeoPoint; to: GeoPoint; at: number }[] = [];
  const activities = new InMemoryActivityRepository();
  const deps: ActivityLogDeps = {
    activities,
    finishedTracks: { trackOf: async () => null },
    router: {
      route: (from, to, type) => {
        calls.push({ from, to, at: now });
        return route(from, to, type);
      },
    },
    gapRouting: {
      setting: { isEnabled: async () => enabled, setEnabled: async (on) => void (enabled = on) },
      isForeground: () => foreground,
      wait: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    },
    clock: { now: () => now },
    afterCommit: () => undefined,
  };
  return {
    deps,
    activities,
    calls,
    waits,
    estimate: new EstimateGapRoutes(deps),
    importRun: (id: string, breaks = 1, startS = 0) =>
      new ImportActivity(deps).execute({ id, type: 'run', points: brokenRun(breaks, startS) }),
    advance: (ms: number) => void (now += ms),
    setEnabled: (on: boolean) => void (enabled = on),
    setForeground: (on: boolean) => void (foreground = on),
  };
}

describe('EstimateGapRoutes', () => {
  it('routes a GPS gap and credits moving time at the average speed, not the gap duration', async () => {
    const t = setup();
    await t.importRun('a');
    expect(await t.estimate.execute()).toBe(1);
    const [r] = await t.activities.gapRoutesOf('a');
    expect(r.distanceM).toBeCloseTo(400 * 1.2, 0); // 400 m straight between the last and next fix
    expect(r.movingS).toBeCloseTo(r.distanceM / (1000 / 330), 0);
    expect(r.movingS).toBeLessThan(233); // the gap lasted 233 s
  });

  it('never routes a manual pause of a recorded session', async () => {
    const t = setup();
    const points = brokenRun(2);
    const record = new RecordActivityFromSession({
      ...t.deps,
      finishedTracks: { trackOf: async () => points },
    });
    await record.execute({
      sessionId: 's',
      activityType: 'run',
      startedAt: points[0].t,
      endedAt: points.at(-1)!.t,
      resumedSegments: [1], // the first break was Pause/Resume, the second a GPS gap
    });
    await t.estimate.execute();
    expect(t.calls).toHaveLength(1);
    const routes = await t.activities.gapRoutesOf('s');
    expect(routes.map((r) => r.afterSegment)).toEqual([1]);
  });

  it('makes no request when the setting is off, and estimates once it is on again', async () => {
    const t = setup();
    await t.importRun('a');
    t.setEnabled(false);
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls).toHaveLength(0);
    expect(await t.activities.idsWithUncheckedGaps()).toEqual(['a']); // still to do
    t.setEnabled(true);
    expect(await t.estimate.execute()).toBe(1);
  });

  it('makes no request while the app is not in the foreground (headless launch)', async () => {
    const t = setup();
    await t.importRun('a');
    t.setForeground(false);
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls).toHaveLength(0);
  });

  it('skips gaps near the start or end without any request and marks the activity checked', async () => {
    const t = setup();
    // 100 m, outage, 1 km: the gap starts 100 m from the start (home privacy).
    const pts = brokenRun(1).filter((p) => p.segment === 1 || p.lat <= 52.2 + 100 / M_PER_DEG_LAT);
    await new ImportActivity(t.deps).execute({ id: 'a', type: 'run', points: pts });
    expect(await t.estimate.execute()).toBe(1);
    expect(t.calls).toHaveLength(0);
    expect(await t.activities.gapRoutesOf('a')).toEqual([]);
    expect(await t.activities.idsWithUncheckedGaps()).toEqual([]);
  });

  it('paces requests at most one per second', async () => {
    const t = setup();
    await t.importRun('a', 3);
    await t.estimate.execute();
    expect(t.calls).toHaveLength(3);
    const gaps = t.calls.slice(1).map((c, i) => c.at - t.calls[i].at);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(MIN_REQUEST_INTERVAL_MS);
    }
  });

  it('keeps going after one activity fails and backs that activity off', async () => {
    let failFor = 'a';
    const t = setup(async (from, to, type) => {
      if (failFor === 'a' && from.lat < 52.25) {
        throw new Error('router 500');
      }
      return straightish(from, to, type);
    });
    await t.importRun('a', 1, 0);
    // A second run far away (different latitude) recorded later.
    const far = brokenRun(1, 10_000).map((p) => ({ ...p, lat: p.lat + 0.1 }));
    await new ImportActivity(t.deps).execute({ id: 'b', type: 'run', points: far });

    expect(await t.estimate.execute()).toBe(1); // b done despite a failing
    expect(await t.activities.idsWithUncheckedGaps()).toEqual(['a']);

    // Backoff: a re-run within the first backoff step does not ask for 'a' again.
    const calls = t.calls.length;
    failFor = '';
    t.advance(1_000);
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls.length).toBe(calls);

    t.advance(60_000);
    expect(await t.estimate.execute()).toBe(1);
    expect(await t.activities.idsWithUncheckedGaps()).toEqual([]);
  });

  it('stops the whole run on HTTP 429 and honours Retry-After', async () => {
    let limited = true;
    const t = setup(async (from, to, type) => {
      if (limited) {
        throw new RouterRateLimited(120_000);
      }
      return straightish(from, to, type);
    });
    await t.importRun('a');
    await t.importRun('b', 1, 10_000);
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls).toHaveLength(1); // b not even tried
    limited = false;
    t.advance(119_000);
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls).toHaveLength(1);
    t.advance(1_000);
    expect(await t.estimate.execute()).toBe(2);
  });

  it('stops the run when offline and tries again later without penalising the activity', async () => {
    let offline = true;
    const t = setup(async (from, to, type) => {
      if (offline) {
        throw new RouterUnreachable();
      }
      return straightish(from, to, type);
    });
    await t.importRun('a');
    await t.importRun('b', 1, 10_000);
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls).toHaveLength(1);
    offline = false;
    t.advance(OFFLINE_RETRY_MS);
    expect(await t.estimate.execute()).toBe(2);
  });

  it(`caps a run at ${MAX_REQUESTS_PER_RUN} requests, then cools down`, async () => {
    const t = setup();
    for (let i = 0; i < MAX_REQUESTS_PER_RUN + 5; i++) {
      await t.importRun(`a${i}`, 1, i * 10_000);
    }
    expect(await t.estimate.execute()).toBe(MAX_REQUESTS_PER_RUN);
    expect(t.calls).toHaveLength(MAX_REQUESTS_PER_RUN);
    expect(await t.estimate.execute()).toBe(0); // cooling down
    t.advance(RUN_COOLDOWN_MS);
    expect(await t.estimate.execute()).toBe(5);
  });

  it('stops when the setting is turned off mid-run', async () => {
    const t = setup();
    await t.importRun('a', 3);
    const origWait = t.deps.gapRouting.wait;
    t.deps.gapRouting.wait = async (ms) => {
      t.setEnabled(false);
      await origWait(ms);
    };
    expect(await t.estimate.execute()).toBe(0);
    expect(t.calls).toHaveLength(1);
  });
});

describe('CapEstimatedMovingTime (data repair)', () => {
  it('caps moving time of routes stored with the whole gap duration, once', async () => {
    const t = setup();
    await t.importRun('a');
    await t.activities.saveGapRoutes('a', [{ afterSegment: 0, distanceM: 405, movingS: 600, coords: [] }], T0);
    const repair = new CapEstimatedMovingTime(t.deps);
    expect(await repair.execute()).toEqual({ checked: 1, capped: 1 });
    const [r] = await t.activities.gapRoutesOf('a');
    expect(r.movingS).toBeCloseTo(405 / (1000 / 330), 0);
    expect(await repair.execute()).toEqual({ checked: 1, capped: 0 });
    expect(t.calls).toHaveLength(0); // local only
  });
});

describe('RouterBudget', () => {
  it('backs a failing activity off exponentially and forgets it on success', () => {
    let now = 0;
    const b = new RouterBudget(
      () => now,
      async () => undefined
    );
    b.failed('a');
    expect(b.isBackingOff('a')).toBe(true);
    now = 60_000;
    expect(b.isBackingOff('a')).toBe(false);
    b.failed('a'); // second failure: 2 minutes
    now += 119_000;
    expect(b.isBackingOff('a')).toBe(true);
    now += 1_000;
    expect(b.isBackingOff('a')).toBe(false);
    b.succeeded('a');
    b.failed('a');
    now += 60_000;
    expect(b.isBackingOff('a')).toBe(false); // reset to the first step
    expect(b.isBackingOff('other')).toBe(false);
  });

  it('caps Retry-After and defaults it when missing', () => {
    let now = 0;
    const b = new RouterBudget(
      () => now,
      async () => undefined
    );
    b.rateLimited(null);
    expect(b.beginRun()).toBe(false);
    now = 60_000;
    expect(b.beginRun()).toBe(true);
    b.rateLimited(10 * 24 * 3600_000);
    now += 3600_000;
    expect(b.beginRun()).toBe(true);
  });
});
