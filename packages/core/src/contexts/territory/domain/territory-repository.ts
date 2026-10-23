import type { ActivityType, BoundingBox } from '../../../shared-kernel';
import type { CellId } from './cell-grid';
import type { Claim } from './claim';

export interface CellRow {
  cell: CellId;
  lat: number;
  lon: number;
  walk: number;
  run: number;
  cycle: number;
  firstAt: number;
}

/** A Turf Cell's visit counts per activity type (no centroid: list pages never need one). */
export interface CellCountsRow {
  cell: CellId;
  walk: number;
  run: number;
  cycle: number;
}

export interface TerritoryRepository {
  claimExists(activityId: string): Promise<boolean>;
  existingCells(cells: Iterable<CellId>): Promise<Set<CellId>>;
  /** Atomic: claim + its cells + projection increments + events (outbox). */
  saveClaim(
    claim: Claim,
    newCells: ReadonlySet<CellId>,
    centroids: Map<CellId, { lat: number; lon: number }>,
    areas: Map<CellId, number>
  ): Promise<void>;
  /** Atomic: projection decrements, removes cells left with no visits, deletes the claim. */
  releaseClaim(activityId: string, now: number): Promise<boolean>;
  cellsIn(bbox: BoundingBox, types: readonly ActivityType[]): Promise<CellRow[]>;
  allCells(): Promise<CellRow[]>;
  /**
   * One page of the cells' counts sorted by cell id in JS string order (byte order: `COLLATE "C"`,
   * SQLite's BINARY), `limit` rows from `offset`, plus how many cells there are in all. Reads only
   * the page, not the whole projection.
   */
  cellCounts(page: { offset: number; limit: number }): Promise<{ rows: CellCountsRow[]; total: number }>;
  claimOf(activityId: string): Promise<{
    cellCount: number;
    newCellCount: number;
    newAreaM2: number;
    cells: { cell: CellId; isNew: boolean }[];
  } | null>;
}
