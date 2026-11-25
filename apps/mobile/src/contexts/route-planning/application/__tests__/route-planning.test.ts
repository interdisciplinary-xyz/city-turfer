import type { ActivityType, GeoPoint } from '@/shared-kernel';

import type { RoutingConsentState } from '../../contract';
import { PlannedRoute } from '../../domain/planned-route';
import type { PlannedRouteRepository } from '../../domain/planned-route-repository';
import { createRoutePlanningApi } from '../../index';
import type { StreetRouting } from '../ports';

// Synthetic points in Gdańsk (no real user data).
const A = { lat: 54.35, lon: 18.65 };
const B = { lat: 54.352, lon: 18.65 };
const C = { lat: 54.352, lon: 18.654 };
const D = { lat: 54.35, lon: 18.654 };
/** A street detour between two Waypoints, as a router would return it. */
const via = (a: GeoPoint, b: GeoPoint): GeoPoint[] => [
  a,
  { lat: (a.lat + b.lat) / 2 + 0.0005, lon: (a.lon + b.lon) / 2 + 0.0005 },
  b,
];

function setup(o: { consent?: RoutingConsentState; answer?: (w: readonly GeoPoint[]) => StreetRouting } = {}) {
  let stored: ReturnType<PlannedRoute['toState']> | null = null;
  let saves = 0;
  let consent: RoutingConsentState = o.consent ?? 'granted';
  const calls: { waypoints: GeoPoint[]; type: ActivityType }[] = [];
  const estimated: GeoPoint[][] = [];
  let now = 1_000;
  const routes: PlannedRouteRepository = {
    // Through a copy of the state, as SQLite would.
    active: async () => (stored ? PlannedRoute.rehydrate(stored) : null),
    save: async (r) => {
      saves++;
      stored = JSON.parse(JSON.stringify(r.toState()));
    },
  };
  const api = createRoutePlanningApi({
    routes,
    router: {
      route: async (waypoints, type) => {
        calls.push({ waypoints: [...waypoints], type });
        return (
          o.answer?.(waypoints) ?? { kind: 'routed', legs: waypoints.slice(1).map((to, i) => via(waypoints[i], to)) }
        );
      },
    },
    consent: { state: async () => consent, set: async (g) => void (consent = g ? 'granted' : 'declined') },
    turf: {
      // A cell per line point; the cells of A are already the Turfer's.
      estimate: async (line) => {
        estimated.push([...line]);
        const cells = [...new Set(line.map((p) => `${p.lat},${p.lon}`))];
        const fresh = cells.filter((c) => c !== `${A.lat},${A.lon}`);
        return { cells, newCells: fresh.map((id) => ({ id, ring: [] })), newAreaM2: fresh.length * 1000 };
      },
    },
    clock: { now: () => now },
  });
  return {
    api,
    calls,
    estimated,
    saves: () => saves,
    stored: () => stored,
    tick: () => void (now += 1000),
  };
}

describe('Route Planning use cases', () => {
  it('reads an empty Planned Route before the first tap, without saving it', async () => {
    const t = setup();
    expect(await t.api.active.execute()).toMatchObject({
      type: 'walk',
      waypoints: [],
      legs: [],
      distanceM: 0,
      newCellCount: 0,
      showOnRecord: false,
      updatedAt: null,
    });
    expect(t.saves()).toBe(0);
    expect(t.estimated).toEqual([]);
  });

  it('snaps only the new leg after each tap and scores the whole route', async () => {
    const t = setup();
    await t.api.addWaypoint.execute(A);
    expect(t.calls).toEqual([]); // one Waypoint: nothing to route
    await t.api.addWaypoint.execute(B);
    const v = await t.api.addWaypoint.execute(C);
    expect(t.calls.map((c) => c.waypoints)).toEqual([
      [A, B],
      [B, C],
    ]);
    expect(v.legs.map((l) => l.snapped)).toEqual([true, true]);
    expect(v.legs[0].coordinates).toEqual(via(A, B).map((p) => [p.lon, p.lat]));
    expect(v.waypoints).toEqual([A, B, C]);
    // The estimate scored every leg as drawn; A was turf already.
    expect(t.estimated.at(-1)).toEqual([...via(A, B), ...via(B, C)]);
    expect(v.cellCount).toBe(5);
    expect(v.newCellCount).toBe(4);
    expect(v.newAreaM2).toBe(4000);
    expect(v.distanceM).toBeCloseTo(
      v.legs.reduce((m, l) => m + l.distanceM, 0),
      9
    );
    expect(v.durationS).toBeGreaterThan(0);
  });

  it('without consent never calls the router; straight legs still score', async () => {
    for (const consent of ['unasked', 'declined'] as const) {
      const t = setup({ consent });
      await t.api.addWaypoint.execute(A);
      await t.api.addWaypoint.execute(B);
      await t.api.closeLoop.execute();
      await t.api.setType.execute('cycle');
      const v = await t.api.snap.execute();
      expect(t.calls).toEqual([]);
      expect(v.legs.map((l) => l.snapped)).toEqual([false, false]);
      expect(v.legs[0].coordinates).toEqual([
        [A.lon, A.lat],
        [B.lon, B.lat],
      ]);
      expect(v.newCellCount).toBe(1); // B (A is turf already)
      expect(v.distanceM).toBeGreaterThan(400);
    }
  });

  it('after consent, snap routes the straight legs in one request', async () => {
    const t = setup({ consent: 'unasked' });
    for (const p of [A, B, C]) {
      await t.api.addWaypoint.execute(p);
    }
    expect(await t.api.routingConsent.execute()).toBe('unasked');
    await t.api.setRoutingConsent.execute(true);
    expect(await t.api.routingConsent.execute()).toBe('granted');
    const v = await t.api.snap.execute();
    expect(t.calls.map((c) => c.waypoints)).toEqual([[A, B, C]]);
    expect(v.legs.every((l) => l.snapped)).toBe(true);
    await t.api.snap.execute(); // nothing straight left: no request
    expect(t.calls).toHaveLength(1);
  });

  /** Three straight legs A→B→C→D, then consent: the snap asks for all three in one request. */
  async function threeStraightLegs(answer: (w: readonly GeoPoint[]) => StreetRouting) {
    const t = setup({ consent: 'unasked', answer });
    for (const p of [A, B, C, D]) {
      await t.api.addWaypoint.execute(p);
    }
    await t.api.setRoutingConsent.execute(true);
    return t;
  }
  const routed = (w: readonly GeoPoint[]): StreetRouting => ({
    kind: 'routed',
    legs: w.slice(1).map((to, i) => via(w[i], to)),
  });
  const same = (p: GeoPoint, q: GeoPoint) => p.lat === q.lat && p.lon === q.lon;

  it('a run with no route as a whole is asked again leg by leg: only the unroutable leg stays straight', async () => {
    // B→C has no way (B on an isolated footway, say), so the 3-leg request is a NoRoute too.
    const t = await threeStraightLegs((w) =>
      w.length > 2 || (same(w[0], B) && same(w[1], C)) ? { kind: 'no-route' } : routed(w)
    );
    const v = await t.api.snap.execute();
    expect(t.calls.map((c) => c.waypoints)).toEqual([
      [A, B, C, D],
      [A, B],
      [B, C],
      [C, D],
    ]);
    expect(v.legs.map((l) => l.snapped)).toEqual([true, false, true]);
    expect(v.legs[0].coordinates).toEqual(via(A, B).map((p) => [p.lon, p.lat]));
    expect(v.legs[2].coordinates).toEqual(via(C, D).map((p) => [p.lon, p.lat]));
    expect(t.stored()?.legs.map((l) => l.snapped)).toEqual([true, false, true]);
  });

  it('leg-by-leg retries stop the whole snap at the first unavailable answer', async () => {
    const t = await threeStraightLegs((w) =>
      w.length > 2 ? { kind: 'no-route' } : { kind: 'unavailable', reason: 'rate-limited' }
    );
    const v = await t.api.snap.execute();
    expect(t.calls.map((c) => c.waypoints)).toEqual([
      [A, B, C, D],
      [A, B],
    ]);
    expect(v.legs.map((l) => l.snapped)).toEqual([false, false, false]);
  });

  it('a single leg with no route is not asked again', async () => {
    const t = setup({ answer: () => ({ kind: 'no-route' }) });
    await t.api.addWaypoint.execute(A);
    await t.api.addWaypoint.execute(B);
    expect(t.calls).toHaveLength(1);
  });

  it('keeps a leg straight when the router has no route or is unavailable, and saves the tap anyway', async () => {
    const answers: StreetRouting[] = [
      { kind: 'no-route' },
      { kind: 'unavailable', reason: 'offline' },
      { kind: 'unavailable', reason: 'rate-limited' },
    ];
    for (const answer of answers) {
      const t = setup({ answer: () => answer });
      await t.api.addWaypoint.execute(A);
      const v = await t.api.addWaypoint.execute(B);
      expect(v.legs).toEqual([
        {
          coordinates: [
            [A.lon, A.lat],
            [B.lon, B.lat],
          ],
          snapped: false,
          distanceM: expect.any(Number),
        },
      ]);
      expect(t.stored()?.waypoints).toEqual([A, B]);
    }
  });

  it('a router that throws leaves the leg straight; the edit is kept', async () => {
    const t = setup({
      answer: () => {
        throw new Error('boom');
      },
    });
    await t.api.addWaypoint.execute(A);
    const v = await t.api.addWaypoint.execute(B);
    expect(v.legs[0].snapped).toBe(false);
    expect(t.stored()?.legs).toHaveLength(1);
  });

  it('a route of the wrong shape changes nothing', async () => {
    const t = setup({ answer: () => ({ kind: 'routed', legs: [] }) });
    await t.api.addWaypoint.execute(A);
    expect((await t.api.addWaypoint.execute(B)).legs[0].snapped).toBe(false);
  });

  it('undo and clear never route', async () => {
    const t = setup();
    for (const p of [A, B, C]) {
      await t.api.addWaypoint.execute(p);
    }
    const n = t.calls.length;
    expect((await t.api.undo.execute()).waypoints).toEqual([A, B]);
    const cleared = await t.api.clear.execute();
    expect(cleared).toMatchObject({ waypoints: [], legs: [], distanceM: 0, newCellCount: 0 });
    expect(cleared.updatedAt).not.toBeNull();
    expect(t.calls).toHaveLength(n);
  });

  it('close loop routes only the closing leg', async () => {
    const t = setup();
    for (const p of [A, B, C]) {
      await t.api.addWaypoint.execute(p);
    }
    const v = await t.api.closeLoop.execute();
    expect(t.calls.at(-1)?.waypoints).toEqual([C, A]);
    expect(v.isLoop).toBe(true);
    await expect(setup().api.closeLoop.execute()).rejects.toThrow('planned-route.loop-too-short');
  });

  it('changing between foot and bike re-routes every leg in one request with the new type', async () => {
    const t = setup();
    for (const p of [A, B, C, D]) {
      await t.api.addWaypoint.execute(p);
    }
    const n = t.calls.length;
    await t.api.setType.execute('run');
    expect(t.calls).toHaveLength(n); // same streets
    const v = await t.api.setType.execute('cycle');
    expect(t.calls.slice(n)).toEqual([{ waypoints: [A, B, C, D], type: 'cycle' }]);
    expect(v.type).toBe('cycle');
    expect(v.legs.every((l) => l.snapped)).toBe(true);
  });

  it('the type of an empty plan is remembered for the first tap', async () => {
    const t = setup();
    await t.api.setType.execute('cycle');
    await t.api.addWaypoint.execute(A);
    await t.api.addWaypoint.execute(B);
    expect(t.calls[0].type).toBe('cycle');
  });

  it('Use on Record, dismiss, and a refusal for less than a route', async () => {
    const t = setup();
    await t.api.addWaypoint.execute(A);
    await expect(t.api.showOnRecord.execute(true)).rejects.toThrow('planned-route.too-short');
    await t.api.addWaypoint.execute(B);
    expect((await t.api.showOnRecord.execute(true)).showOnRecord).toBe(true);
    expect((await t.api.active.execute()).showOnRecord).toBe(true);
    expect((await t.api.showOnRecord.execute(false)).showOnRecord).toBe(false);
  });

  it('runs quick taps one after another, none lost', async () => {
    const t = setup();
    const views = await Promise.all([A, B, C, D].map((p) => t.api.addWaypoint.execute(p)));
    expect(views.at(-1)?.waypoints).toEqual([A, B, C, D]);
    expect(t.calls.map((c) => c.waypoints)).toEqual([
      [A, B],
      [B, C],
      [C, D],
    ]);
  });

  it('a rejected edit stores nothing and does not block the next one', async () => {
    const t = setup();
    await expect(t.api.addWaypoint.execute({ lat: 120, lon: 0 })).rejects.toThrow('geo.invalid-latitude');
    expect(t.saves()).toBe(0);
    expect((await t.api.addWaypoint.execute(A)).waypoints).toEqual([A]);
  });

  it('tells subscribers after every committed edit, not after a no-op', async () => {
    const t = setup();
    const heard: number[] = [];
    const stop = t.api.subscribe((v) => heard.push(v.waypoints.length));
    await t.api.addWaypoint.execute(A);
    await t.api.addWaypoint.execute(B);
    await t.api.addWaypoint.execute(B); // same point: ignored
    await t.api.undo.execute();
    stop();
    await t.api.undo.execute();
    expect(heard).toEqual([1, 2, 1]);
  });

  it('re-reads the turf estimate on every read (turf grows after a recording)', async () => {
    const t = setup();
    await t.api.addWaypoint.execute(A);
    await t.api.addWaypoint.execute(B);
    const before = t.estimated.length;
    await t.api.active.execute();
    expect(t.estimated.length).toBe(before + 1);
  });
});
