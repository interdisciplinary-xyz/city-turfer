import { type ActivityType, DomainError, type Track } from '../../../shared-kernel';
import type { TurfClaimed } from '../contract';
import type { CellGrid, CellId } from './cell-grid';
import { cellsAlong } from './corridor';

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
    // Never bridge segment gaps: each segment is walked independently.
    for (const seg of track.segments) {
      for (const c of cellsAlong(seg, grid)) {
        cells.add(c);
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
