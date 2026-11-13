// The share card's place query through the app's wiring, on real SQL: the track comes from the
// Activity Log's SQLite store, the boundaries from the bundled districts. Expected district from a
// plain ray cast of the demo route over pl-gdansk.json (all of Oliwa Park's path is in Oliwa).
import { GDANSK_ROUTES, trackAlongPath } from '@cityturfer/core/demo';

import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

const NOW = Date.UTC(2026, 10, 11, 12);

function device() {
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
    router: {
      route: async () => {
        throw new Error('offline');
      },
    },
    ids: { next: () => `id-${++n}` },
    clock: { now: () => NOW },
  };
}

const TABLES_WRITTEN = ['sys_outbox', 'sys_diagnostics'];

describe('container.territory.activityPlace (wiring, real SQL)', () => {
  it('names the city and district of a stored activity, and writes nothing', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    const c = wire('place', db, device());
    const route = GDANSK_ROUTES.find((r) => r.name === 'Oliwa Park')!;
    const points = trackAlongPath(route.path, route.type, NOW - 3_600_000, 3);
    expect(await c.activityLog.importActivity.execute({ id: 'a1', type: route.type, points })).toBe(true);
    await c.dispatcher.dispatchPending();

    const count = async () =>
      Promise.all(
        TABLES_WRITTEN.map(async (t) => (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))[0].n)
      );
    const before = await count();
    const place = await c.territory.activityPlace.execute('a1');
    expect(place.city).toMatchObject({ id: 'pl-gdansk', name: 'Gdańsk' });
    expect(place.district).toBe('Oliwa');
    expect(await count()).toEqual(before);
  });

  it('an unknown activity is nowhere', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    const c = wire('place', db, device());
    expect(await c.territory.activityPlace.execute('nope')).toEqual({ city: null, district: null });
  });
});
