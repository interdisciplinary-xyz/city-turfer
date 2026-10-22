import { userId } from '@cityturfer/core/identity/ports';

import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

import { prepareDemoAccount, trackAlongPath } from '../gdansk-demo';
import data from '../gdansk-routes.json';

function fakes() {
  let n = 0;
  return {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    gapRouting: {
      setting: { isEnabled: async () => false, setEnabled: async () => undefined },
      isForeground: () => true,
      wait: async () => undefined,
    },
    ids: { next: () => `id-${++n}` },
    clock: { now: () => Date.now() },
  };
}

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  return wire('demo', db, fakes());
}

const demo = { id: userId('demo'), email: 'demo@cityturfer.com', displayName: 'Ola' };
const GDANSK: [number, number, number, number] = [18.5, 54.3, 18.8, 54.45]; // [west, south, east, north]

describe('Gdańsk demo account', () => {
  it('every route is a loop inside Gdańsk', () => {
    for (const r of data.routes) {
      for (const [lat, lon] of r.path) {
        expect(lon).toBeGreaterThan(GDANSK[0]);
        expect(lat).toBeGreaterThan(GDANSK[1]);
        expect(lon).toBeLessThan(GDANSK[2]);
        expect(lat).toBeLessThan(GDANSK[3]);
      }
      const [first, last] = [r.path[0], r.path[r.path.length - 1]];
      expect(Math.abs(first[0] - last[0]) + Math.abs(first[1] - last[1])).toBeLessThan(0.001);
    }
  });

  it('a track follows its route at walking pace', () => {
    const route = data.routes[0];
    const pts = trackAlongPath(route.path as [number, number][], 'walk', 0, 1);
    const minutes = (pts[pts.length - 1].t - pts[0].t) / 60_000;
    expect(minutes).toBeGreaterThan(route.distanceM / 1.6 / 60);
    expect(minutes).toBeLessThan(route.distanceM / 1.1 / 60);
  });

  it('fills the demo account once: Gdańsk as Home City, months of activities, turf claimed', async () => {
    const c = await setup();
    await prepareDemoAccount(demo, c);
    expect((await c.territory.homeCity.execute())?.name).toBe('Gdańsk');
    const all = await c.activityLog.list.execute(500);
    expect(all.length).toBeGreaterThan(50);
    expect(new Set(all.map((a) => a.type))).toEqual(new Set(['walk', 'run', 'cycle']));
    const summary = await c.territory.summary.execute();
    expect(summary.cellCount).toBeGreaterThan(500);
    expect((await c.territory.viewport.execute(GDANSK, 14)).length).toBeGreaterThan(0);

    await prepareDemoAccount(demo, c);
    expect((await c.activityLog.list.execute(500)).length).toBe(all.length);
  }, 120_000);

  it('leaves other accounts alone', async () => {
    const c = await setup();
    await prepareDemoAccount({ ...demo, id: userId('admin') }, c);
    expect(await c.activityLog.list.execute(1)).toEqual([]);
    expect(await c.territory.homeCity.execute()).toBeNull();
  });
});
