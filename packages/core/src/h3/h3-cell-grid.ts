import type { CellGrid, CellId } from '../contexts/territory/ports';
import type { GeoPoint } from '../shared-kernel';
import { cellArea, cellToBoundary, cellToLatLng, cellToParent, getHexagonEdgeLengthAvg, latLngToCell } from './h3';

/** Turf Cells are H3 resolution 11 hexagons (~50 m across); zoomed-out aggregation uses res 9. */
export class H3CellGrid implements CellGrid {
  readonly cellWidthM: number;
  constructor(
    private readonly res = 11,
    private readonly coarseRes = 9
  ) {
    this.cellWidthM = getHexagonEdgeLengthAvg(res, 'm') * Math.sqrt(3);
  }
  cellOf(p: GeoPoint): CellId {
    return latLngToCell(p.lat, p.lon, this.res);
  }
  centroid(c: CellId): GeoPoint {
    const [lat, lon] = cellToLatLng(c);
    return { lat, lon };
  }
  boundary(c: CellId): GeoPoint[] {
    return cellToBoundary(c).map(([lat, lon]) => ({ lat, lon }));
  }
  areaM2(c: CellId): number {
    return cellArea(c, 'm2');
  }
  coarse(c: CellId): CellId {
    return cellToParent(c, this.coarseRes);
  }
}
