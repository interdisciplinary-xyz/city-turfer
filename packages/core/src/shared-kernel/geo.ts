import { EARTH_RADIUS_M } from '../constants/geo';
import { DomainError } from './errors';

export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
}

export function geoPoint(lat: number, lon: number): GeoPoint {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new DomainError('geo.invalid-latitude', String(lat));
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new DomainError('geo.invalid-longitude', String(lon));
  }
  return { lat, lon };
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (haversine). Matches tools/lib/geo.mjs. */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function interpolate(a: GeoPoint, b: GeoPoint, f: number): GeoPoint {
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
}

/** [west, south, east, north] */
export type BoundingBox = readonly [number, number, number, number];

export function boundingBoxOf(points: Iterable<GeoPoint>): BoundingBox | null {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const p of points) {
    if (p.lon < w) {
      w = p.lon;
    }
    if (p.lon > e) {
      e = p.lon;
    }
    if (p.lat < s) {
      s = p.lat;
    }
    if (p.lat > n) {
      n = p.lat;
    }
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}
