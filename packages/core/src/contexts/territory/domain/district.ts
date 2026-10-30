import { EARTH_RADIUS_M } from '../../../constants/geo';
import type { BoundingBox } from '../../../shared-kernel';

/** [lon, lat] in degrees, as in GeoJSON. */
export type LonLat = readonly [number, number];
/** A closed ring (first point = last point). */
export type Ring = readonly LonLat[];
/** Outer ring first, then its holes. */
export type DistrictPolygon = readonly Ring[];

/**
 * An administrative district of a catalogue city (OpenStreetMap boundary, bundled with the app):
 * the unit the Districts screen splits a city into. Never changes at runtime.
 */
export interface District {
  /** Stable id from the source, e.g. `osm-r2618447`. */
  id: string;
  cityId: string;
  /** Local name, as the district's people know it. */
  name: string;
  /** One or more polygons (a district can have exclaves). */
  polygons: readonly DistrictPolygon[];
}

const RAD = Math.PI / 180;

/**
 * Signed ring area in m² on the shared-kernel sphere (`EARTH_RADIUS_M`), by Chamberlain & Duquette
 * (as apps/mobile/tools/gen-districts.mjs): positive when the ring runs counter-clockwise, as
 * RFC 7946 outer rings do. Within 0.03 % of the summed H3 area of the cells whose centre lies in
 * the ring (H3 measures on a sphere too), so a district's turf share can't read above what it holds.
 */
export function signedRingAreaM2(ring: Ring): number {
  if (ring.length < 4) {
    return 0;
  }
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[i + 1];
    s += (l2 - l1) * RAD * (2 + Math.sin(p1 * RAD) + Math.sin(p2 * RAD));
  }
  return (-s * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2;
}

/** Ring area in m² on the sphere, whichever way it winds. */
export function ringAreaM2(ring: Ring): number {
  return Math.abs(signedRingAreaM2(ring));
}

/** The district's area in m²: outer rings minus their holes. */
export function districtAreaM2(d: District): number {
  let a = 0;
  for (const [outer, ...holes] of d.polygons) {
    a += ringAreaM2(outer) - holes.reduce((sum, h) => sum + ringAreaM2(h), 0);
  }
  return Math.max(0, a);
}

/** [west, south, east, north] around every outer ring. */
export function boundsOf(rings: Iterable<Ring>): BoundingBox {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
  }
  return [w, s, e, n];
}

export function districtBounds(d: District): BoundingBox {
  return boundsOf(d.polygons.map((p) => p[0]));
}

/** Ray casting: is the point inside the closed ring? */
export function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside one of the district's polygons and not in that polygon's holes. */
export function districtContains(d: District, lon: number, lat: number): boolean {
  return d.polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)));
}

/**
 * A point strictly inside a polygon ([outer, ...holes]): the middle of the widest stretch inside it
 * along a few scan lines that miss every vertex. Works for concave shapes and holes (unlike the
 * centroid) and is never on the boundary. Null for a polygon with no area.
 */
export function interiorPoint(polygon: DistrictPolygon): LonLat | null {
  let s = Infinity;
  let n = -Infinity;
  const vertexLats = new Set<number>();
  for (const ring of polygon) {
    for (const [, lat] of ring) {
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      vertexLats.add(lat);
    }
  }
  let best: LonLat | null = null;
  let widest = 0;
  for (const f of [0.5, 0.25, 0.75, 0.375, 0.625, 0.125, 0.875]) {
    let lat = s + (n - s) * f;
    while (vertexLats.has(lat)) {
      lat += (n - s) * 1e-9;
    }
    const xs: number[] = [];
    for (const ring of polygon) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if (y1 > lat !== y2 > lat) {
          xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > widest) {
        widest = xs[i + 1] - xs[i];
        best = [(xs[i] + xs[i + 1]) / 2, lat];
      }
    }
  }
  return best;
}

/** Grid buckets per side of a DistrictIndex: about 100–200 m at city scale. */
const INDEX_SIDE = 256;

/** A ring's edges by grid row: [x1, y1, x2, y2, ...] of every edge whose latitude span meets the row. */
type RowEdges = Float64Array[];

/**
 * Finds the district holding a point with little work, with the same answer as testing every
 * district in order (the first that holds the point, -1 for none):
 * - the districts' box is split into a grid; a bucket no border crosses takes one answer for all
 *   its points (worked out once, on first use);
 * - in a bucket a border crosses, only districts whose box reaches it are tested, and the ray cast
 *   reads only the edges in the point's grid row (an edge outside the row can't cross the ray).
 */
export class DistrictIndex {
  private readonly boxes: BoundingBox[];
  private readonly bounds: BoundingBox;
  private readonly candidates: number[][];
  private readonly crossed: Uint8Array;
  /** -2: not worked out yet. */
  private readonly answer: Int32Array;
  /** Per district, per polygon: [outer, ...holes] edges by row. */
  private readonly rings: RowEdges[][][];
  private readonly dx: number;
  private readonly dy: number;

  constructor(private readonly districts: readonly District[]) {
    this.boxes = districts.map(districtBounds);
    this.bounds = boundsOf(districts.flatMap((d) => d.polygons.map((p) => p[0])));
    const [w, s, e, n] = this.bounds;
    this.dx = (e - w) / INDEX_SIDE || 1;
    this.dy = (n - s) / INDEX_SIDE || 1;
    const size = INDEX_SIDE * INDEX_SIDE;
    this.candidates = Array.from({ length: size }, () => []);
    this.crossed = new Uint8Array(size);
    this.answer = new Int32Array(size).fill(-2);
    this.boxes.forEach(([bw, bs, be, bn], i) => {
      const [x0, y0] = this.bucket(bw, bs);
      const [x1, y1] = this.bucket(be, bn);
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          this.candidates[y * INDEX_SIDE + x].push(i);
        }
      }
    });
    this.rings = districts.map((d) => d.polygons.map((p) => p.map((ring) => this.rowEdges(ring))));
  }

  private bucket(lon: number, lat: number): [number, number] {
    const clamp = (v: number) => Math.min(INDEX_SIDE - 1, Math.max(0, Math.floor(v)));
    return [clamp((lon - this.bounds[0]) / this.dx), clamp((lat - this.bounds[1]) / this.dy)];
  }

  /** Sorts a ring's edges into rows, and marks every bucket an edge's box touches as crossed. */
  private rowEdges(ring: Ring): RowEdges {
    const rows: number[][] = Array.from({ length: INDEX_SIDE }, () => []);
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const [ax, ay] = this.bucket(xi, yi);
      const [bx, by] = this.bucket(xj, yj);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
        rows[y].push(xi, yi, xj, yj);
        for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
          this.crossed[y * INDEX_SIDE + x] = 1;
        }
      }
    }
    return rows.map((r) => Float64Array.from(r));
  }

  /** Ray casting over one row's edges: the same test as `inRing`, edge for edge. */
  private static inRow(lon: number, lat: number, edges: Float64Array): boolean {
    let inside = false;
    for (let k = 0; k < edges.length; k += 4) {
      const xi = edges[k];
      const yi = edges[k + 1];
      const xj = edges[k + 2];
      const yj = edges[k + 3];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private contains(i: number, lon: number, lat: number, row: number): boolean {
    return this.rings[i].some(
      ([outer, ...holes]) =>
        DistrictIndex.inRow(lon, lat, outer[row]) && !holes.some((h) => DistrictIndex.inRow(lon, lat, h[row]))
    );
  }

  private scan(b: number, lon: number, lat: number): number {
    const row = this.bucket(lon, lat)[1];
    for (const i of this.candidates[b]) {
      const [w, s, e, n] = this.boxes[i];
      if (lon >= w && lon <= e && lat >= s && lat <= n && this.contains(i, lon, lat, row)) {
        return i;
      }
    }
    return -1;
  }

  /** Index of the district holding the point, -1 for none. */
  locate(lon: number, lat: number): number {
    const [w, s, e, n] = this.bounds;
    if (!(lon >= w && lon <= e && lat >= s && lat <= n)) {
      return -1;
    }
    const [x, y] = this.bucket(lon, lat);
    const b = y * INDEX_SIDE + x;
    if (this.crossed[b]) {
      return this.scan(b, lon, lat);
    }
    if (this.answer[b] === -2) {
      // No border inside the bucket: its middle has the answer for every point in it.
      this.answer[b] = this.scan(b, w + (x + 0.5) * this.dx, s + (y + 0.5) * this.dy);
    }
    return this.answer[b];
  }
}

/**
 * Index of the district holding each point (-1: none). A point goes to the first district in order
 * that contains it, so a point on a shared border counts once.
 */
export function assignToDistricts(districts: readonly District[], points: readonly LonLat[]): number[] {
  const index = new DistrictIndex(districts);
  return points.map(([lon, lat]) => index.locate(lon, lat));
}
