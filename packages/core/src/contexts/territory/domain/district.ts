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

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON_EQUATOR = 111_320;

/** Ring area in m², equirectangular around the ring's first point (fine at city scale). Positive. */
export function ringAreaM2(ring: Ring): number {
  if (ring.length < 4) {
    return 0;
  }
  const mx = M_PER_DEG_LON_EQUATOR * Math.cos((ring[0][1] * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return (Math.abs(s) / 2) * mx * M_PER_DEG_LAT;
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
 * Index of the district holding each point (-1: none). A point goes to the first district in order
 * that contains it, so a point on a shared border counts once. Bounding boxes are checked first.
 */
export function assignToDistricts(districts: readonly District[], points: readonly LonLat[]): number[] {
  const boxes = districts.map(districtBounds);
  return points.map(([lon, lat]) => {
    for (let i = 0; i < districts.length; i++) {
      const [w, s, e, n] = boxes[i];
      if (lon >= w && lon <= e && lat >= s && lat <= n && districtContains(districts[i], lon, lat)) {
        return i;
      }
    }
    return -1;
  });
}
