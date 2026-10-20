import type { GeoPoint } from '../../../shared-kernel';

export type CellId = string;

/** Spatial index port. The domain never sees h3-js. */
export interface CellGrid {
  readonly cellWidthM: number;
  cellOf(p: GeoPoint): CellId;
  centroid(c: CellId): GeoPoint;
  boundary(c: CellId): GeoPoint[];
  areaM2(c: CellId): number;
  /** Coarser cell containing `c`, for zoomed-out aggregation. */
  coarse(c: CellId): CellId;
}
