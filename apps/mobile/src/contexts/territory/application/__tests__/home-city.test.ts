import { migrate } from '@/platform/migrations';
import { DomainError } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';

import { SqliteHomeCityRepository } from '../../infrastructure/sqlite-home-city-repository';
import { ChooseHomeCity, GetHomeCity, SearchCities } from '../home-city';

const NOW = Date.parse('2026-10-19T12:00:00Z');

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  const afterCommit = jest.fn();
  const deps = { homeCities: new SqliteHomeCityRepository(db), clock: { now: () => NOW }, afterCommit };
  return { db, afterCommit, get: new GetHomeCity(deps), choose: new ChooseHomeCity(deps) };
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
    expect(JSON.parse(events[0].payload)).toEqual({ type: 'HomeCityChosen', v: 1, at: NOW, cityId: 'pl-krakow' });
    expect(afterCommit).toHaveBeenCalledTimes(1);
  });

  it('replaces and clears the choice', async () => {
    const { get, choose } = await setup();
    await choose.execute('pl-krakow');
    await choose.execute('pl-gdansk');
    expect((await get.execute())?.id).toBe('pl-gdansk');
    await choose.execute(null);
    expect(await get.execute()).toBeNull();
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
    const fresh = new GetHomeCity({
      homeCities: new SqliteHomeCityRepository(db),
      clock: { now: () => NOW },
      afterCommit: () => undefined,
    });
    expect((await fresh.execute())?.name).toBe('Wrocław');
  });
});

describe('SearchCities', () => {
  it('returns city views for the picker', () => {
    const [first] = new SearchCities().execute('pozn');
    expect(first).toMatchObject({ id: 'pl-poznan', name: 'Poznań' });
    expect(first.bounds).toHaveLength(4);
  });
});
