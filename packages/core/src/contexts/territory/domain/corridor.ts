import { distanceM, type GeoPoint, interpolate } from '../../../shared-kernel';
import type { CellGrid, CellId } from './cell-grid';

/**
 * The Turf Cells a line covers: every point's cell plus samples every half cell width between
 * consecutive points, so a fast or sparse line skips no cell. A cell appears once; the order is the
 * order the line reaches them. The corridor rule of a Claim (`Claim.fromTrack` runs it per segment),
 * also used to estimate the turf a Planned Route would claim. Pure; never bridges anything but
 * consecutive points of this one line.
 */
export function cellsAlong(line: readonly GeoPoint[], grid: CellGrid): Set<CellId> {
  const cells = new Set<CellId>();
  const step = grid.cellWidthM / 2;
  for (let i = 0; i < line.length; i++) {
    cells.add(grid.cellOf(line[i]));
    const next = line[i + 1];
    if (!next) {
      break;
    }
    const n = Math.ceil(distanceM(line[i], next) / step);
    for (let s = 1; s < n; s++) {
      cells.add(grid.cellOf(interpolate(line[i], next, s / n)));
    }
  }
  return cells;
}
