import type { DistrictCoverageView } from '../contract';

type Ring = [number, number][];

/** Even-odd ray cast: whether [lon, lat] lies inside the ring. */
function inRing(ring: Ring, lon: number, lat: number): boolean {
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

/**
 * The district whose boundary holds the tapped point (`null`: none). Picks by geometry rather than
 * by the map's rendered-feature query, whose touch box on iOS also takes in the neighbour across a
 * border. A point in a hole of a polygon is not in that polygon.
 */
export function districtAt(
  districts: readonly Pick<DistrictCoverageView, 'id' | 'bounds' | 'polygons'>[],
  lon: number,
  lat: number
): string | null {
  for (const d of districts) {
    const [w, s, e, n] = d.bounds;
    if (lon < w || lon > e || lat < s || lat > n) {
      continue;
    }
    for (const [outer, ...holes] of d.polygons) {
      if (outer && inRing(outer, lon, lat) && !holes.some((h) => inRing(h, lon, lat))) {
        return d.id;
      }
    }
  }
  return null;
}
