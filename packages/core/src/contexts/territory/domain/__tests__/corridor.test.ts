import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { H3CellGrid } from '../../../../h3';
import { distanceM, type GeoPoint, interpolate, trackFromPoints, type TrackPoint } from '../../../../shared-kernel';
import type { CellGrid } from '../cell-grid';
import { Claim } from '../claim';
import { cellsAlong } from '../corridor';

const grid = new H3CellGrid();

/** Synthetic GPX fixture (apps/mobile/tools/fixtures): lat/lon of every point, in order. */
function fixtureLine(name: string): GeoPoint[] {
  const gpx = readFileSync(join(__dirname, '../../../../../../../apps/mobile/tools/fixtures', name), 'utf8');
  return [...gpx.matchAll(/<trkpt lat="([-\d.]+)" lon="([-\d.]+)"/g)].map((m) => ({
    lat: Number(m[1]),
    lon: Number(m[2]),
  }));
}

/** Claim.fromTrack's corridor loop as it was before cellsAlong was extracted (characterisation). */
function corridorBeforeExtraction(segments: readonly (readonly GeoPoint[])[], g: CellGrid): string[] {
  const cells = new Set<string>();
  const step = g.cellWidthM / 2;
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      cells.add(g.cellOf(seg[i]));
      const next = seg[i + 1];
      if (!next) {
        break;
      }
      const n = Math.ceil(distanceM(seg[i], next) / step);
      for (let s = 1; s < n; s++) {
        cells.add(g.cellOf(interpolate(seg[i], next, s / n)));
      }
    }
  }
  return [...cells];
}

const pt = (p: GeoPoint, t: number, segment: number): TrackPoint => ({
  ...p,
  t,
  segment,
  alt: null,
  accuracy: 5,
  speed: null,
});

describe('cellsAlong', () => {
  it.each(['walk-2k.gpx', 'cycle-20k.gpx', 'run-5k-outliers-pause.gpx'])(
    'gives the cells (and their order) of the corridor rule before the extraction: %s',
    (name) => {
      const line = fixtureLine(name);
      expect(line.length).toBeGreaterThan(100);
      expect([...cellsAlong(line, grid)]).toEqual(corridorBeforeExtraction([line], grid));
    }
  );

  it('leaves Claim.fromTrack unchanged across segments (never bridging the gap)', () => {
    const line = fixtureLine('walk-2k.gpx');
    const half = Math.floor(line.length / 2);
    const points = line.map((p, i) => pt(p, i * 1000, i < half ? 0 : i < half + 40 ? 1 : 2));
    const track = trackFromPoints(points);
    const claim = Claim.fromTrack({ activityId: 'a', type: 'walk', startedAt: 0 }, track, grid, 1e9);
    expect([...claim.state.cells]).toEqual(corridorBeforeExtraction(track.segments, grid));
  });

  it('fills the corridor between two far apart points (no skipped cell)', () => {
    const cells = cellsAlong(
      [
        { lat: 52.2, lon: 21.0 },
        { lat: 52.209, lon: 21.0 },
      ],
      grid
    );
    expect(cells.size).toBeGreaterThanOrEqual(Math.floor(1000 / grid.cellWidthM));
  });

  it('counts a cell once and covers a single point with its own cell', () => {
    const p = { lat: 54.35, lon: 18.65 };
    expect([...cellsAlong([p, p, p], grid)]).toEqual([grid.cellOf(p)]);
    expect([...cellsAlong([p], grid)]).toEqual([grid.cellOf(p)]);
  });

  it('is empty for an empty line', () => {
    expect(cellsAlong([], grid).size).toBe(0);
  });
});
