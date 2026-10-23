import { EARTH_RADIUS_M } from '../constants';
import type { GeoPoint } from '../shared-kernel';

/** The point `distM` metres from `p` along `bearingDeg` (great circle). */
export function destination(p: GeoPoint, bearingDeg: number, distM: number): GeoPoint {
  const d = distM / EARTH_RADIUS_M,
    br = (bearingDeg * Math.PI) / 180,
    la1 = (p.lat * Math.PI) / 180,
    lo1 = (p.lon * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
}

/** A small seeded random generator: the same seed gives the same demo data everywhere. */
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal sample from `rand` (Box–Muller). */
export const gaussian = (rand: () => number) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
