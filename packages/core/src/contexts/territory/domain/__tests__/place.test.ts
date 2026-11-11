import type { GeoPoint } from '../../../../shared-kernel';
import type { City } from '../city';
import type { District, Ring } from '../district';
import type { DistrictCatalog } from '../district-catalog';
import { PLACE_SAMPLE, placeOf, sampleEvenly } from '../place';

// A made-up world on the equator (1° ≈ 111.2 km), so distances are easy to check by hand:
// - t-a: radius 10 km at (0, 0), with two districts, west (lon −0.1…0) and east (lon 0…0.1), lat ±0.05;
// - t-c: radius 8 km at lon 0.12, no districts; its circle overlaps t-a's east district;
// - t-b: radius 5 km at lon 0.2, no districts; its circle overlaps t-c's;
// - t-far: far away (lat 5), with districts.
const square = (lon: number, lat: number, size: number): Ring => [
  [lon, lat],
  [lon + size, lat],
  [lon + size, lat + size],
  [lon, lat + size],
  [lon, lat],
];
const city = (id: string, lon: number, radiusKm: number, lat = 0): City => ({
  id,
  name: id.toUpperCase(),
  country: 'XX',
  center: { lat, lon },
  radiusM: radiusKm * 1000,
});
const CITIES: City[] = [city('t-far', 0, 10, 5), city('t-b', 0.2, 5), city('t-c', 0.12, 8), city('t-a', 0, 10)];
const WEST: District = { id: 'w', cityId: 't-a', name: 'West', polygons: [[square(-0.1, -0.05, 0.1)]] };
const EAST: District = { id: 'e', cityId: 't-a', name: 'East', polygons: [[square(0, -0.05, 0.1)]] };
const FAR: District = { id: 'f', cityId: 't-far', name: 'Far', polygons: [[square(-0.1, 4.95, 0.2)]] };
const DATA: Record<string, District[]> = { 't-a': [WEST, EAST], 't-far': [FAR] };

function catalog(asked: string[] = []): DistrictCatalog {
  return {
    districtsOf: (id) => {
      asked.push(id);
      return DATA[id] ?? [];
    },
  };
}
const at = (lon: number, lat = 0): GeoPoint => ({ lat, lon });
const many = (n: number, lon: number, lat = 0): GeoPoint[] => Array.from({ length: n }, () => at(lon, lat));
const names = (p: ReturnType<typeof placeOf>) => (p ? [p.city.id, p.district?.name ?? null] : null);

describe('placeOf', () => {
  it('names the city and the district holding most of the points', () => {
    expect(names(placeOf([...many(3, -0.05), ...many(5, 0.05)], CITIES, catalog()))).toEqual(['t-a', 'East']);
    expect(names(placeOf([...many(5, -0.05), ...many(3, 0.05)], CITIES, catalog()))).toEqual(['t-a', 'West']);
  });

  it('is nowhere for no points or points in no catalogue city', () => {
    expect(placeOf([], CITIES, catalog())).toBeNull();
    expect(placeOf(many(10, 3, 3), CITIES, catalog())).toBeNull();
  });

  it('a city without districts holds the points within its radius, with no district', () => {
    expect(names(placeOf(many(4, 0.21), CITIES, catalog()))).toEqual(['t-b', null]);
  });

  it("a city's districts decide over another city's overlapping circle", () => {
    // lon 0.08: in t-a's east district and 4.4 km from t-c (within its 8 km).
    expect(names(placeOf(many(4, 0.08), CITIES, catalog()))).toEqual(['t-a', 'East']);
    // lon 0.105: 1.7 km from t-c, 11.7 km from t-a's centre but outside its districts: t-c's.
    expect(names(placeOf(many(4, 0.105), CITIES, catalog()))).toEqual(['t-c', null]);
  });

  it('a point outside a district city’s districts is not that city’s, even inside its circle', () => {
    // lat 0.07, lon 0: 7.8 km from t-a's centre (radius 10 km) but north of both districts.
    expect(placeOf(many(4, 0, 0.07), CITIES, catalog())).toBeNull();
  });

  it('where circles overlap, the city nearest relative to its radius holds the point', () => {
    // lon 0.175: 6.1 km / 8 km from t-c, 2.8 km / 5 km from t-b → t-b.
    expect(names(placeOf(many(2, 0.175), CITIES, catalog()))).toEqual(['t-b', null]);
    // lon 0.16: 4.4 km / 8 km from t-c, 4.4 km / 5 km from t-b → t-c.
    expect(names(placeOf(many(2, 0.16), CITIES, catalog()))).toEqual(['t-c', null]);
  });

  it('the city with most points wins, even one without districts', () => {
    expect(names(placeOf([...many(3, 0.05), ...many(5, 0.21)], CITIES, catalog()))).toEqual(['t-b', null]);
  });

  it('reads the districts of the nearest city first and no more once every point is placed', () => {
    const asked: string[] = [];
    placeOf([at(0.02), at(0.05), at(0.09)], CITIES, catalog(asked));
    expect(asked).toEqual(['t-a']); // t-c is near (within 3 radii) but never needed; t-far never
  });

  it('samples a long track: 50,000 points, most in the west, in well under a second', () => {
    const track = [...many(30_000, -0.05), ...many(20_000, 0.05)];
    const t0 = Date.now();
    expect(names(placeOf(track, CITIES, catalog()))).toEqual(['t-a', 'West']);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe('sampleEvenly', () => {
  it('keeps every item when there are no more than asked', () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('spreads the sample from the first item to the last', () => {
    const items = Array.from({ length: 1001 }, (_, i) => i);
    expect(sampleEvenly(items, 11)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(sampleEvenly(items, PLACE_SAMPLE)).toHaveLength(PLACE_SAMPLE);
  });

  it('handles a sample of one or none', () => {
    expect(sampleEvenly([1, 2, 3], 1)).toEqual([1]);
    expect(sampleEvenly([1, 2, 3], 0)).toEqual([]);
  });
});
