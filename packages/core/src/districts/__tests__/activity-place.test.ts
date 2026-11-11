// GetActivityPlace on the bundled district boundaries and the Gdańsk demo routes. Here rather than in
// the territory context: only src/districts may load the boundary data (districts-data-only-via-entry).
// Expected districts come from a plain ray cast of each route's path over pl-gdansk.json, not from
// the code under test: Oliwa Park all in Oliwa; Wrzeszcz and Jaśkowa Dolina all in Wrzeszcz Górny;
// Main Town loop all in Śródmieście; Brzeźno beach 77 % Przymorze Wielkie, 19 % Brzeźno, the rest in
// two more districts.
import { createTerritoryApi } from '../../contexts/territory';
import { GetActivityPlace } from '../../contexts/territory/application/activity-place';
import { GDANSK_ROUTES, trackAlongPath } from '../../demo';
import type { TrackPoint } from '../../shared-kernel';
import { bundledDistricts } from '..';

const T0 = Date.UTC(2026, 10, 11, 8);

function placeOfTracks(tracks: Record<string, TrackPoint[]>) {
  const asked: string[] = [];
  const use = new GetActivityPlace({
    tracks: { trackOf: async (id) => tracks[id] ?? [] },
    districts: {
      districtsOf: (id) => {
        asked.push(id);
        return bundledDistricts.districtsOf(id);
      },
    },
  });
  return { execute: (id: string) => use.execute(id), asked };
}

function routeTrack(name: string): TrackPoint[] {
  const route = GDANSK_ROUTES.find((r) => r.name === name);
  if (!route) {
    throw new Error(`no demo route ${name}`);
  }
  return trackAlongPath(route.path, route.type, T0, 7);
}

const point = (lat: number, lon: number, k: number): TrackPoint => ({
  lat,
  lon,
  t: T0 + k * 1000,
  segment: 0,
  alt: null,
  accuracy: 5,
  speed: null,
});
/** A short straight line of points from (lat, lon), about 1 m apart. */
const lineAt = (lat: number, lon: number, n = 50) => Array.from({ length: n }, (_, k) => point(lat + k * 1e-5, lon, k));

describe('GetActivityPlace (bundled districts, Gdańsk demo routes)', () => {
  it.each([
    ['Oliwa Park', 'Oliwa'],
    ['Wrzeszcz and Jaśkowa Dolina', 'Wrzeszcz Górny'],
    ['Main Town loop', 'Śródmieście'],
    ['Brzeźno beach', 'Przymorze Wielkie'],
  ])('%s: Gdańsk, %s', async (route, district) => {
    const place = placeOfTracks({ a: routeTrack(route) });
    const v = await place.execute('a');
    expect(v.city).toMatchObject({ id: 'pl-gdansk', name: 'Gdańsk' });
    expect(v.district).toBe(district);
    expect(place.asked).toEqual(['pl-gdansk']); // one city's boundaries read, no neighbour's
  });

  it('a long ride (the 2-hour seaside path, many times over) is sampled and still names its district', async () => {
    const ride = routeTrack('Seaside bike path');
    const long = Array.from({ length: 10 }, () => ride).flat();
    const t0 = Date.now();
    const v = await placeOfTracks({ a: long }).execute('a');
    expect(v.city?.id).toBe('pl-gdansk');
    expect(v.district).not.toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('a route outside every catalogue city is nowhere', async () => {
    // Hel, at the tip of the Hel peninsula: 30 km from Gdynia, 33 km from Gdańsk.
    expect(await placeOfTracks({ a: lineAt(54.6083, 18.8017) }).execute('a')).toEqual({ city: null, district: null });
  });

  it('a city without bundled districts names the city only', async () => {
    // Sopot's pier (Sopot has no district file; its neighbours Gdańsk and Gdynia do, and don't hold it).
    const v = await placeOfTracks({ a: lineAt(54.4466, 18.5701) }).execute('a');
    expect(v.city).toMatchObject({ id: 'pl-sopot', name: 'Sopot' });
    expect(v.district).toBeNull();
  });

  it('an unknown activity or one without Track Points is nowhere', async () => {
    expect(await placeOfTracks({ empty: [] }).execute('empty')).toEqual({ city: null, district: null });
    expect(await placeOfTracks({}).execute('missing')).toEqual({ city: null, district: null });
  });

  it('is on the Territory API as activityPlace', () => {
    const api = createTerritoryApi({} as Parameters<typeof createTerritoryApi>[0]);
    expect(api.activityPlace).toBeInstanceOf(GetActivityPlace);
  });
});
