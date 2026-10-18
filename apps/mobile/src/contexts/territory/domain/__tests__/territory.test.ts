import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { trackFromPoints, type TrackPoint } from '@/shared-kernel';

import { H3CellGrid } from '../../infrastructure/h3-cell-grid';
import { Claim } from '../claim';
import { isStrong, strengthOf, tierOf } from '../strength';

const grid = new H3CellGrid();
const pt = (lat: number, lon: number, t: number, segment = 0): TrackPoint => ({
  lat,
  lon,
  t,
  segment,
  alt: null,
  accuracy: 5,
  speed: null,
});

interface Vectors {
  strengthVectors: { visits: number; k: number; strength: number; tier: string; strong: boolean }[];
  tierBoundaryVectors: { strength: number; tier: string; strong: boolean }[];
}
// Shared with tools/lib/turf.mjs (tools/__tests__/turf-parity.test.mjs): the formula is pinned here.
const vectors: Vectors = JSON.parse(
  readFileSync(join(__dirname, '../../../../../tools/fixtures/turf-vectors.json'), 'utf8')
);

describe('Strength vs tools/fixtures/turf-vectors.json', () => {
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

describe('Strength (permanent turf)', () => {
  it.each([
    [1, 0.2835, 'faint'],
    [3, 0.6321, 'glowing'],
    [7, 0.903, 'blazing'],
    [10, 0.9643, 'blazing'],
  ])('%i visits → %f (%s)', (visits, strength, tier) => {
    expect(strengthOf(visits)).toBeCloseTo(strength, 3);
    expect(tierOf(strengthOf(visits))).toBe(tier);
  });
  it('rejects zero visits', () => expect(() => strengthOf(0)).toThrow());
});

describe('Claim', () => {
  it('claims every cell along a fast segment (no skipped cells)', () => {
    // two points 1 km apart: densification must fill the corridor
    const track = trackFromPoints([pt(52.2, 21.0, 0), pt(52.209, 21.0, 60_000)]);
    const claim = Claim.fromTrack({ activityId: 'a', type: 'cycle', startedAt: 0 }, track, grid, 100_000);
    const widthM = grid.cellWidthM;
    expect(claim.state.cells.size).toBeGreaterThanOrEqual(Math.floor(1000 / widthM));
  });

  it('never bridges segment gaps', () => {
    const track = trackFromPoints([
      pt(52.2, 21.0, 0, 0),
      pt(52.2001, 21.0, 1000, 0),
      pt(52.3, 21.0, 600_000, 1),
      pt(52.3001, 21.0, 601_000, 1),
    ]);
    const claim = Claim.fromTrack({ activityId: 'a', type: 'walk', startedAt: 0 }, track, grid, 1e6);
    expect(claim.state.cells.size).toBeLessThan(10);
  });

  it('counts a cell once per activity even when looping', () => {
    const loop = Array.from({ length: 50 }, (_, i) => pt(52.2 + (i % 2) * 0.0001, 21.0, i * 1000));
    const claim = Claim.fromTrack({ activityId: 'a', type: 'run', startedAt: 0 }, trackFromPoints(loop), grid, 1e6);
    expect(claim.state.cells.size).toBeLessThanOrEqual(3);
  });
});
