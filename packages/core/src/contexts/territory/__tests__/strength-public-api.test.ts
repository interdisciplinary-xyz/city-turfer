/**
 * The turf strength rule as clients of `GET /v1/turf/cells` use it: through the public entry
 * (`@cityturfer/core/territory`), from `TurfCellCounts` rows. Pinned by the same vectors as the
 * domain (apps/mobile/tools/fixtures/turf-vectors.json) and checked against the phone's own Turf
 * Map query (`GetTurfInViewport`), so a client derives exactly what the phone shows.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { H3CellGrid } from '../../../h3';
import type { ActivityType, BoundingBox } from '../../../shared-kernel';
import { GetTurfInViewport } from '../application/use-cases';
import type { CellRow, TerritoryRepository } from '../domain/territory-repository';
import { isStrong, strengthOf, tierOf, TURF_SATURATION_K, type TurfCellCounts, visitsOf } from '../index';

interface Vectors {
  defaultK: number;
  strengthVectors: { visits: number; k: number; strength: number; tier: string; strong: boolean }[];
  tierBoundaryVectors: { strength: number; tier: string; strong: boolean }[];
}
const vectors: Vectors = JSON.parse(
  readFileSync(join(__dirname, '../../../../../../apps/mobile/tools/fixtures/turf-vectors.json'), 'utf8')
);
const parity: { summary: { strongCells: number }; cells: [string, number, number, number, number][] } = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/turf-parity.expected.json'), 'utf8')
);

const SELECTIONS: ActivityType[][] = [
  ['walk', 'run', 'cycle'],
  ['walk'],
  ['run'],
  ['cycle'],
  ['walk', 'run'],
  ['walk', 'cycle'],
  ['run', 'cycle'],
];

describe('turf strength via @cityturfer/core/territory', () => {
  it('uses the pinned default k', () => expect(TURF_SATURATION_K).toBe(vectors.defaultK));
  it.each(vectors.strengthVectors)('$visits visits, k=$k -> $strength ($tier)', (v) => {
    const s = strengthOf(v.visits, v.k);
    expect(s).toBeCloseTo(v.strength, 6);
    expect(tierOf(s)).toBe(v.tier);
    expect(isStrong(s)).toBe(v.strong);
  });
  it.each(vectors.tierBoundaryVectors)('strength $strength -> $tier', (v) => {
    expect(tierOf(v.strength)).toBe(v.tier);
    expect(isStrong(v.strength)).toBe(v.strong);
  });
});

describe('visitsOf', () => {
  const row: TurfCellCounts = ['8b1f09b20100fff', 2, 3, 5];
  it('sums every type by default', () => expect(visitsOf(row)).toBe(10));
  it.each([
    [['walk'], 2],
    [['run'], 3],
    [['cycle'], 5],
    [['walk', 'cycle'], 7],
    [['run', 'walk'], 5],
    [[], 0],
  ] as [ActivityType[], number][])('%j -> %i', (types, visits) => expect(visitsOf(row, types)).toBe(visits));
  it('reports 0 for a cell the selection never touched (the phone hides it)', () =>
    expect(visitsOf(['x', 0, 4, 0], ['walk', 'cycle'])).toBe(0));

  it('reproduces the golden strong-cell count from the parity cells', () => {
    const rows = parity.cells.map(([id, w, r, c]): TurfCellCounts => [id, w, r, c]);
    expect(rows.filter((r) => isStrong(strengthOf(visitsOf(r)))).length).toBe(parity.summary.strongCells);
  });
});

describe('client derivation matches the phone Turf Map (GetTurfInViewport)', () => {
  const grid = new H3CellGrid();
  // Real cells from the parity fixture, with a mix of per-type counts (some types zero).
  const counts: TurfCellCounts[] = parity.cells
    .slice(0, 12)
    .map(([id], i): TurfCellCounts => [id, i % 3, (i * 2) % 5, i % 4 === 0 ? 0 : i % 2 === 0 ? 1 : 3]);
  const rows: CellRow[] = counts.map(([cell, walk, run, cycle]) => {
    const c = grid.centroid(cell);
    return { cell, lat: c.lat, lon: c.lon, walk, run, cycle, firstAt: 0 };
  });
  // The SQLite adapter's filter: rows inside the box with any selected type > 0.
  const repo: Pick<TerritoryRepository, 'cellsIn'> = {
    cellsIn: async (_bbox: BoundingBox, types: readonly ActivityType[]) =>
      rows.filter((r) => types.some((t) => r[t] > 0)),
  };
  const viewport = new GetTurfInViewport({
    repo: repo as TerritoryRepository,
    grid,
    tracks: { trackOf: async () => [] },
    clock: { now: () => 0 },
    afterCommit: () => undefined,
  });

  it.each(SELECTIONS.map((s) => [s.join('+'), s] as const))('%s', async (_name, types) => {
    const phone = await viewport.execute([-180, -85, 180, 85], 10, types);
    const client = counts
      .map((r) => ({ id: r[0], visits: visitsOf(r, types) }))
      .filter((c) => c.visits > 0)
      .map((c) => ({ ...c, strength: strengthOf(c.visits), tier: tierOf(strengthOf(c.visits)) }));
    expect(phone.map(({ id, visits, strength, tier }) => ({ id, visits, strength, tier }))).toEqual(client);
  });
});
