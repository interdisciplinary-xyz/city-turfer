import { type ActivityType, distanceM, DomainError, interpolate, type Track } from '@/shared-kernel';

import type { TurfClaimed } from '../contract';
import type { CellGrid, CellId } from './cell-grid';

export interface ClaimState {
  readonly activityId: string;
  readonly type: ActivityType;
  readonly claimedAt: number; // the activity's start, not "now"
  readonly cells: ReadonlySet<CellId>;
}

/**
 * Aggregate: the set of Turf Cells one Activity covered. Created once per
 * activity, immutable; each cell counts at most once per claim.
 */
export class Claim {
  private events: TurfClaimed[] = [];
  private constructor(readonly state: ClaimState) {}

  static fromTrack(
    src: { activityId: string; type: ActivityType; startedAt: number },
    track: Track,
    grid: CellGrid,
    now: number
  ): Claim {
    if (src.startedAt > now + 60_000) {
      throw new DomainError('claim.in-future');
    }
    const cells = new Set<CellId>();
    const step = grid.cellWidthM / 2;
    for (const seg of track.segments) {
      // Never bridge segment gaps: each segment is walked independently.
      for (let i = 0; i < seg.length; i++) {
        cells.add(grid.cellOf(seg[i]));
        const next = seg[i + 1];
        if (!next) {
          break;
        }
        const n = Math.ceil(distanceM(seg[i], next) / step);
        for (let s = 1; s < n; s++) {
          cells.add(grid.cellOf(interpolate(seg[i], next, s / n)));
        }
      }
    }
    if (cells.size === 0) {
      throw new DomainError('claim.empty');
    }
    return new Claim({ activityId: src.activityId, type: src.type, claimedAt: src.startedAt, cells });
  }

  /** Record the outcome once the projection told us which cells were new. */
  claimed(newCells: ReadonlySet<CellId>, grid: CellGrid, now: number): void {
    let area = 0;
    for (const c of newCells) {
      area += grid.areaM2(c);
    }
    this.events.push({
      type: 'TurfClaimed',
      v: 1,
      at: now,
      activityId: this.state.activityId,
      cellCount: this.state.cells.size,
      newCellCount: newCells.size,
      newAreaM2: area,
    });
  }

  pullEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
