import type { CellGrid } from '../../domain/cell-grid';
import type { District, Ring } from '../../domain/district';
import type { DistrictCatalog } from '../../domain/district-catalog';
import type { HomeCityRepository } from '../../domain/home-city-repository';
import type { CellRow, TerritoryRepository } from '../../domain/territory-repository';
import { GetDistrictCoverage } from '../districts';

const square = (lon: number, lat: number, size: number): Ring => [
  [lon, lat],
  [lon + size, lat],
  [lon + size, lat + size],
  [lon, lat + size],
  [lon, lat],
];
// Two districts side by side near Gdańsk's centre (18.65° E, 54.35° N).
const DISTRICTS: District[] = [
  { id: 'd-west', cityId: 'pl-gdansk', name: 'Zachód', polygons: [[square(18.6, 54.3, 0.05)]] },
  { id: 'd-east', cityId: 'pl-gdansk', name: 'Wschód', polygons: [[square(18.65, 54.3, 0.05)]] },
];
const CELL_M2 = 10_000; // 0.01 km² per cell

const row = (cell: string, lon: number, lat: number): CellRow => ({
  cell,
  lat,
  lon,
  walk: 1,
  run: 0,
  cycle: 0,
  firstAt: 0,
});

function coverage(
  homeCityId: string | null,
  rows: CellRow[],
  catalog: Record<string, District[]> = { 'pl-gdansk': DISTRICTS }
) {
  const asked: unknown[] = [];
  const repo = {
    cellsIn: async (bbox: unknown, types: unknown) => {
      asked.push({ bbox, types });
      return rows;
    },
  } as unknown as TerritoryRepository;
  const homeCities = { homeCityId: async () => homeCityId } as unknown as HomeCityRepository;
  const districts: DistrictCatalog = { districtsOf: (id) => catalog[id] ?? [] };
  const grid = { areaM2: () => CELL_M2 } as unknown as CellGrid;
  return { result: new GetDistrictCoverage({ repo, grid, homeCities, districts }).execute(), asked };
}

describe('GetDistrictCoverage', () => {
  it('without a Home City answers no-city', async () => {
    expect(await coverage(null, []).result).toEqual({ status: 'no-city' });
  });

  it('a Home City no longer in the catalogue reads as no city', async () => {
    expect(await coverage('xx-gone', []).result).toEqual({ status: 'no-city' });
  });

  it('a city without district data answers no-data with the city', async () => {
    const r = await coverage('pl-warsaw', []).result;
    expect(r).toMatchObject({ status: 'no-data', city: { id: 'pl-warsaw', name: 'Warsaw' } });
  });

  it('sums the turf in each district by cell centre, ignores cells outside, sorts by turf then name', async () => {
    const { result, asked } = coverage('pl-gdansk', [
      row('a', 18.66, 54.31), // east
      row('b', 18.67, 54.32), // east
      row('c', 18.61, 54.31), // west
      row('d', 18.9, 54.5), // outside both
    ]);
    const r = await result;
    if (r.status !== 'ready') {
      throw new Error(r.status);
    }
    expect(r.districts.map((d) => [d.name, d.cellCount, d.coveredKm2])).toEqual([
      ['Wschód', 2, 0.02],
      ['Zachód', 1, 0.01],
    ]);
    expect(r.coveredKm2).toBeCloseTo(0.03, 10);
    const box = [18.6, 54.3, 18.7, 54.35];
    r.bounds.forEach((v, i) => expect(v).toBeCloseTo(box[i], 9));
    // Every activity type counts; only the districts' box is read.
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ types: ['walk', 'run', 'cycle'] });
    expect((asked[0] as { bbox: number[] }).bbox).toEqual(r.bounds);
    const east = r.districts[0];
    expect(east.areaKm2).toBeCloseTo(0.05 * 111.32 * Math.cos((54.3 * Math.PI) / 180) * 0.05 * 110.54, 3);
    expect(east.share).toBeCloseTo(0.02 / east.areaKm2, 10);
    expect(east.polygons).toEqual([[square(18.65, 54.3, 0.05)]]);
  });

  it('with no turf yet lists every district at zero, by name', async () => {
    const r = await coverage('pl-gdansk', []).result;
    expect(r.status === 'ready' && r.districts.map((d) => [d.name, d.coveredKm2])).toEqual([
      ['Wschód', 0],
      ['Zachód', 0],
    ]);
  });
});
