import { createTerritoryApi, type HomeCityDeps, type TerritoryDeps } from '@/contexts/territory';
import { migrate } from '@/platform/migrations';
import { DomainError } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';

import { SqliteHomeCityRepository } from '../sqlite-home-city-repository';

const NOW = Date.parse('2026-10-19T12:00:00Z');

// The Home City use cases through Territory's public API (they live in @cityturfer/core); the
// claim use cases are not exercised here, so their dependencies are left out.
const homeCityApi = (deps: HomeCityDeps) => createTerritoryApi(deps as TerritoryDeps & HomeCityDeps);

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  const afterCommit = jest.fn();
  const deps = { homeCities: new SqliteHomeCityRepository(db), clock: { now: () => NOW }, afterCommit };
  const api = homeCityApi(deps);
  return { db, afterCommit, get: api.homeCity, choose: api.chooseHomeCity, choice: api.homeCityChoice };
}

const outbox = (db: ReturnType<typeof openNodeDatabase>) =>
  db.all<{ type: string; payload: string }>('SELECT type, payload FROM sys_outbox ORDER BY id');

describe('Home City', () => {
  it('has none until one is chosen', async () => {
    const { get } = await setup();
    expect(await get.execute()).toBeNull();
  });

  it('saves the choice with a HomeCityChosen event in the same transaction', async () => {
    const { db, get, choose, afterCommit } = await setup();
    await choose.execute('pl-krakow');

    const city = await get.execute();
    expect(city).toMatchObject({ id: 'pl-krakow', name: 'Kraków', country: 'PL' });
    expect(city!.center).toEqual([19.9373, 50.0617]);
    const [w, s, e, n] = city!.bounds;
    expect(w).toBeLessThan(19.9373);
    expect(e).toBeGreaterThan(19.9373);
    expect(s).toBeLessThan(50.0617);
    expect(n).toBeGreaterThan(50.0617);

    const events = await outbox(db);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('HomeCityChosen');
    // The event names the city only: no coordinates in the outbox.
    expect(JSON.parse(events[0].payload)).toEqual({
      type: 'HomeCityChosen',
      v: 1,
      at: NOW,
      cityId: 'pl-krakow',
      chosenAt: NOW,
    });
    expect(afterCommit).toHaveBeenCalledTimes(1);
  });

  it('reports the last decision with its time, a cleared one included (Cloud Backup)', async () => {
    const { choose, choice } = await setup();
    expect(await choice.execute()).toBeNull();
    await choose.execute('pl-krakow');
    expect(await choice.execute()).toEqual({ cityId: 'pl-krakow', chosenAt: NOW });
    await choose.execute(null);
    expect(await choice.execute()).toEqual({ cityId: null, chosenAt: NOW });
  });

  it('replaces and clears the choice', async () => {
    const { get, choose } = await setup();
    await choose.execute('pl-krakow');
    await choose.execute('pl-gdansk');
    expect((await get.execute())?.id).toBe('pl-gdansk');
    await choose.execute(null);
    expect(await get.execute()).toBeNull();
  });

  it('keeps when a restored choice was made; an older one never replaces a newer one', async () => {
    const { db, choose, choice } = await setup();
    await choose.execute('pl-gdansk', NOW - 86_400_000);
    expect(await choice.execute()).toEqual({ cityId: 'pl-gdansk', chosenAt: NOW - 86_400_000 });
    expect(JSON.parse((await outbox(db))[0].payload)).toMatchObject({ at: NOW, chosenAt: NOW - 86_400_000 });

    await choose.execute('pl-krakow', NOW - 2 * 86_400_000); // older: ignored
    expect(await choice.execute()).toEqual({ cityId: 'pl-gdansk', chosenAt: NOW - 86_400_000 });
    await choose.execute('pl-warsaw'); // the Turfer's own choice, now: always counts
    expect(await choice.execute()).toEqual({ cityId: 'pl-warsaw', chosenAt: NOW });
    expect(await outbox(db)).toHaveLength(2);
  });

  it('does nothing when the same city is chosen again', async () => {
    const { db, choose, afterCommit } = await setup();
    await choose.execute('pl-warsaw');
    await choose.execute('pl-warsaw');
    expect(await outbox(db)).toHaveLength(1);
    expect(afterCommit).toHaveBeenCalledTimes(1);
  });

  it('rejects a city that is not in the catalogue', async () => {
    const { db, choose } = await setup();
    await expect(choose.execute('xx-atlantis')).rejects.toThrow(DomainError);
    expect(await outbox(db)).toHaveLength(0);
  });

  it('reads an id that left the catalogue as no Home City', async () => {
    const { db, get } = await setup();
    await db.run('INSERT INTO ter_home_city (id, city_id, chosen_at) VALUES (1, ?, ?)', ['xx-gone', NOW]);
    expect(await get.execute()).toBeNull();
  });

  it('persists across repository instances (survives a restart)', async () => {
    const { db, choose } = await setup();
    await choose.execute('pl-wroclaw');
    const fresh = homeCityApi({
      homeCities: new SqliteHomeCityRepository(db),
      clock: { now: () => NOW },
      afterCommit: () => undefined,
    }).homeCity;
    expect((await fresh.execute())?.name).toBe('Wrocław');
  });
});

describe('SearchCities', () => {
  it('returns city views for the picker', () => {
    const [first] = homeCityApi({} as HomeCityDeps).searchCities.execute('pozn');
    expect(first).toMatchObject({ id: 'pl-poznan', name: 'Poznań' });
    expect(first.bounds).toHaveLength(4);
  });
});
