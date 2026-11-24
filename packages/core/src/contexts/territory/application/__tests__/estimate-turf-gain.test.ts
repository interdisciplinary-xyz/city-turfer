import { H3CellGrid } from '../../../../h3';
import type { GeoPoint } from '../../../../shared-kernel';
import type { CellId } from '../../domain/cell-grid';
import { cellsAlong } from '../../domain/corridor';
import type { TerritoryRepository } from '../../domain/territory-repository';
import { EstimateTurfGain } from '../use-cases';

const grid = new H3CellGrid();
// About 1 km north along a meridian in Gdańsk, in two legs.
const LINE: GeoPoint[] = [
  { lat: 54.35, lon: 18.65 },
  { lat: 54.354, lon: 18.65 },
  { lat: 54.359, lon: 18.65 },
];

function estimator(held: Iterable<CellId>) {
  const known = new Set(held);
  const asked: CellId[][] = [];
  const repo = {
    existingCells: async (cells: Iterable<CellId>) => {
      const list = [...cells];
      asked.push(list);
      return new Set(list.filter((c) => known.has(c)));
    },
  } as unknown as TerritoryRepository;
  return { asked, gain: new EstimateTurfGain({ repo, grid }) };
}

describe('EstimateTurfGain', () => {
  it('scores the corridor of the line by the claim rule; with no turf every cell is new', async () => {
    const { gain } = estimator([]);
    const e = await gain.execute(LINE);
    const corridor = [...cellsAlong(LINE, grid)];
    expect(e.cells).toEqual(corridor);
    expect(e.newCells.map((c) => c.id)).toEqual(corridor);
    expect(e.newAreaM2).toBeCloseTo(
      corridor.reduce((s, c) => s + grid.areaM2(c), 0),
      6
    );
  });

  it('separates the cells the Turfer already holds from the new ones', async () => {
    const corridor = [...cellsAlong(LINE, grid)];
    const held = corridor.filter((_, i) => i % 3 === 0);
    const { gain, asked } = estimator([...held, 'not-on-the-line']);
    const e = await gain.execute(LINE);
    expect(asked).toEqual([corridor]); // one query for the whole corridor
    expect(e.cells).toEqual(corridor);
    expect(e.newCells.map((c) => c.id)).toEqual(corridor.filter((c) => !held.includes(c)));
    const area = e.newCells.reduce((s, c) => s + grid.areaM2(c.id), 0);
    expect(e.newAreaM2).toBeCloseTo(area, 6);
  });

  it('gives each new cell a closed [lon, lat] outline', async () => {
    const { gain } = estimator([]);
    const [first] = (await gain.execute(LINE)).newCells;
    const boundary = grid.boundary(first.id).map((p) => [p.lon, p.lat]);
    expect(first.ring).toEqual([...boundary, boundary[0]]);
  });

  it('nothing new when the whole line is turf already', async () => {
    const { gain } = estimator(cellsAlong(LINE, grid));
    expect(await gain.execute(LINE)).toMatchObject({ newCells: [], newAreaM2: 0 });
  });

  it('an empty line claims nothing and asks no question', async () => {
    const { gain, asked } = estimator([]);
    expect(await gain.execute([])).toEqual({ cells: [], newCells: [], newAreaM2: 0 });
    expect(asked).toEqual([]);
  });
});
