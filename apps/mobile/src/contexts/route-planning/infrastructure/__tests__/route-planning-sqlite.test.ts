/**
 * Route Planning through the real wiring and SQL: migration 16, the plan surviving a restart (a new
 * container on the same database), the turf estimate against the Turfer's real turf, and no router
 * call without consent.
 */
import { H3CellGrid } from '@cityturfer/core/h3';

import { migrate } from '@/platform/migrations';
import type { GeoPoint, TrackPoint } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';
import { type DeviceAdapters, wire } from '@/wiring';

import type { RoutingConsentState, StreetRouting } from '../../index';

// Synthetic Gdańsk points (no real user data): A → B is already walked, B → C is not.
const A = { lat: 54.35, lon: 18.65 };
const B = { lat: 54.355, lon: 18.65 };
const C = { lat: 54.355, lon: 18.658 };

function setup(consent: RoutingConsentState = 'granted') {
  const db = openNodeDatabase();
  const calls: GeoPoint[][] = [];
  let answer: StreetRouting | null = null;
  const consents = new Map<string, RoutingConsentState>([['test', consent]]);
  const adapters: DeviceAdapters = {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted', requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    ids: { next: () => 'session-1' },
    clock: { now: () => Date.UTC(2026, 10, 24, 12) },
    routePlanning: {
      router: {
        route: async (waypoints) => {
          calls.push([...waypoints]);
          return answer ?? { kind: 'routed', legs: waypoints.slice(1).map((to, i) => [waypoints[i], to]) };
        },
      },
      consent: (uid) => ({
        state: async () => consents.get(uid) ?? 'unasked',
        set: async (g) => void consents.set(uid, g ? 'granted' : 'declined'),
      }),
    },
  };
  return {
    db,
    calls,
    adapters,
    answer: (a: StreetRouting) => void (answer = a),
    async container() {
      await migrate(db);
      return wire('test', db, adapters);
    },
  };
}

/** A walk from A to B, imported and claimed as turf. */
async function walkAToB(c: ReturnType<typeof wire>) {
  const n = 60;
  const points: TrackPoint[] = Array.from({ length: n + 1 }, (_, i) => ({
    lat: A.lat + ((B.lat - A.lat) * i) / n,
    lon: A.lon,
    t: Date.UTC(2026, 10, 20, 8) + i * 10_000,
    segment: 0,
    alt: null,
    accuracy: 5,
    speed: 1.4,
  }));
  expect(await c.activityLog.importActivity.execute({ id: 'walk-ab', type: 'walk', points })).toBe(true);
  await c.dispatcher.dispatchPending();
  expect((await c.territory.summary.execute()).cellCount).toBeGreaterThan(0);
}

describe('Route Planning on SQLite', () => {
  it('keeps the Planned Route across a restart (a new container on the same database)', async () => {
    const t = setup();
    const c = await t.container();
    await c.routePlanning.setType.execute('run');
    for (const p of [A, B, C]) {
      await c.routePlanning.addWaypoint.execute(p);
    }
    await c.routePlanning.showOnRecord.execute(true);
    const before = await c.routePlanning.active.execute();

    const again = wire('test', t.db, t.adapters);
    const after = await again.routePlanning.active.execute();
    expect(after).toEqual(before);
    expect(after).toMatchObject({ type: 'run', waypoints: [A, B, C], showOnRecord: true });
    expect(after.legs.map((l) => l.snapped)).toEqual([true, true]);
    expect(await t.db.first('SELECT COUNT(*) AS n FROM rp_planned_routes')).toEqual({ n: 1 });
  });

  it('estimates only the cells the Turfer does not hold yet, by the claim rule', async () => {
    const t = setup();
    const c = await t.container();
    await walkAToB(c);
    for (const p of [A, B]) {
      await c.routePlanning.addWaypoint.execute(p);
    }
    const walked = await c.routePlanning.active.execute();
    expect(walked.cellCount).toBeGreaterThan(10);
    expect(walked.newCellCount).toBe(0); // the street from A to B is turf already
    expect(walked.newAreaM2).toBe(0);

    const v = await c.routePlanning.addWaypoint.execute(C);
    expect(v.newCellCount).toBeGreaterThan(10);
    expect(v.newCellCount).toBeLessThan(v.cellCount);
    const grid = new H3CellGrid();
    expect(v.newAreaM2).toBeCloseTo(
      v.newCells.reduce((s, cell) => s + grid.areaM2(cell.id), 0),
      3
    );
    expect(v.newCells.every((cell) => cell.ring.length === 7)).toBe(true); // closed hexagon
    // An estimate claims nothing.
    expect((await c.territory.summary.execute()).cellCount).toBe(walked.cellCount);
  });

  it('without consent sends nothing; the straight legs are stored and scored', async () => {
    const t = setup('unasked');
    const c = await t.container();
    for (const p of [A, B, C]) {
      await c.routePlanning.addWaypoint.execute(p);
    }
    await c.routePlanning.closeLoop.execute();
    await c.routePlanning.setType.execute('cycle');
    const v = await c.routePlanning.snap.execute();
    expect(t.calls).toEqual([]);
    expect(v.legs.map((l) => l.snapped)).toEqual([false, false, false]);
    expect(v.newCellCount).toBeGreaterThan(0);

    await c.routePlanning.setRoutingConsent.execute(true);
    await c.routePlanning.snap.execute();
    expect(t.calls).toEqual([[A, B, C, A]]);
  });

  it('a tap stays saved when the router is unavailable', async () => {
    const t = setup();
    const c = await t.container();
    t.answer({ kind: 'unavailable', reason: 'offline' });
    await c.routePlanning.addWaypoint.execute(A);
    await c.routePlanning.addWaypoint.execute(B);
    const v = await wire('test', t.db, t.adapters).routePlanning.active.execute();
    expect(v.waypoints).toEqual([A, B]);
    expect(v.legs[0].snapped).toBe(false);
  });

  it('writes no domain event (nothing for the outbox, nothing for the cloud backup)', async () => {
    const t = setup();
    const c = await t.container();
    await c.routePlanning.addWaypoint.execute(A);
    await c.routePlanning.addWaypoint.execute(B);
    await c.routePlanning.showOnRecord.execute(true);
    expect(await t.db.all('SELECT type FROM sys_outbox')).toEqual([]);
  });

  it('a plan from a v15 database: the migration adds the table and planning works', async () => {
    const t = setup();
    await migrate(t.db, 15);
    const c = await t.container();
    expect((await c.routePlanning.active.execute()).updatedAt).toBeNull();
    await c.routePlanning.addWaypoint.execute(A);
    expect((await c.routePlanning.active.execute()).waypoints).toEqual([A]);
  });

  it('an unreadable stored plan reads as none and is replaced by the next edit', async () => {
    const t = setup();
    const c = await t.container();
    await t.db.run(
      `INSERT INTO rp_planned_routes (id, type, waypoints, legs, show_on_record, created_at, updated_at)
       VALUES (1, 'walk', 'not json', '[]', 0, 1, 1)`
    );
    expect((await c.routePlanning.active.execute()).updatedAt).toBeNull();
    expect((await c.routePlanning.addWaypoint.execute(B)).waypoints).toEqual([B]);
  });
});
