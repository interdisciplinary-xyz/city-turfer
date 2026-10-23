import { GDANSK_ROUTES } from '@cityturfer/core/demo';

import type { User } from '@/contexts/identity';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

import { prepareDemoAccount, seedGdanskDemo, trackAlongPath } from '../gdansk-demo';

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

const demo = { id: 'demo', email: 'demo@cityturfer.com', displayName: 'Ola' } as User;
const GDANSK: [number, number, number, number] = [18.5, 54.3, 18.8, 54.45]; // [west, south, east, north]

describe('Gdańsk demo account', () => {
  it('every route is a loop inside Gdańsk', () => {
    for (const r of GDANSK_ROUTES) {
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
    const route = GDANSK_ROUTES[0];
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

  it('finishes an interrupted fill on a later day, without duplicates', async () => {
    const c = await setup();
    const full = await setup();
    await prepareDemoAccount(demo, full);
    const expected = (await full.activityLog.list.execute(500)).length;

    // A legacy id (from before ids were stable) is replaced, not duplicated.
    const legacy = (await full.activityLog.list.execute(1))[0];
    const track = await full.activityLog.trackQuery.execute(legacy.id);
    await c.activityLog.importActivity.execute({ id: 'demo-gdansk-1700000000000', type: legacy.type, points: track });

    // The app is killed during the first sign-in, after ten activities.
    await expect(
      seedGdanskDemo(c, (done) => {
        if (done === 10) {
          throw new Error('killed');
        }
      })
    ).rejects.toThrow('killed');
    expect((await c.territory.homeCity.execute())?.name).toBe('Gdańsk');
    expect(await c.activityLog.list.execute(500)).toHaveLength(10);

    // Signed in again three days later: the rest arrives, the first ten are not imported again.
    jest.useFakeTimers({
      now: Date.now() + 3 * 86_400_000,
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask', 'clearTimeout'],
    });
    try {
      await prepareDemoAccount(demo, c);
      const ids = (await c.activityLog.list.execute(500)).map((a) => a.id);
      expect(ids).toHaveLength(expected);
      expect(new Set(ids).size).toBe(expected);
      expect(ids).not.toContain('demo-gdansk-1700000000000');
      expect(await seedGdanskDemo(c)).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  }, 240_000);

  it('leaves other accounts alone', async () => {
    const c = await setup();
    await prepareDemoAccount({ ...demo, id: 'admin' as User['id'] }, c);
    expect(await c.activityLog.list.execute(1)).toEqual([]);
    expect(await c.territory.homeCity.execute()).toBeNull();
  });
});
