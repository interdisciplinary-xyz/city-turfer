/**
 * Dev-only: generate months of overlapping activity history around a point
 * (favourite routes repeated with fresh GPS noise + occasional explorations),
 * imported through Activity Log so it claims turf exactly like real activities.
 * Port of tools/lib/generate.mjs + tools/gen-history.mjs.
 */
import type { Container } from '@/composition-root';
import type { ActivityType, GeoPoint, TrackPoint } from '@/shared-kernel';

const R = 6371008.8;
function destination(p: GeoPoint, bearingDeg: number, distM: number): GeoPoint {
  const d = distM / R,
    br = (bearingDeg * Math.PI) / 180,
    la1 = (p.lat * Math.PI) / 180,
    lo1 = (p.lon * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
}
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const gaussian = (rand: () => number) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const SPEED: Record<ActivityType, number> = { walk: 1.4, run: 3.0, cycle: 6.5 };

function generateTrack(
  type: ActivityType,
  km: number,
  start: GeoPoint,
  seed: number,
  noiseSeed: number,
  startTime: number
): TrackPoint[] {
  const rand = mulberry32(seed);
  const nrand = mulberry32(noiseSeed);
  const interval = 3;
  let pos = start,
    heading = rand() * 360,
    t = startTime,
    travelled = 0,
    east = 0,
    north = 0;
  const phi = Math.pow(0.97, interval),
    innov = Math.sqrt(1 - phi * phi);
  const out: TrackPoint[] = [];
  while (travelled < km * 1000) {
    east = phi * east + innov * gaussian(nrand) * 4;
    north = phi * north + innov * gaussian(nrand) * 4;
    const off = Math.hypot(east, north);
    const o = off > 0 ? destination(pos, (Math.atan2(east, north) * 180) / Math.PI, off) : pos;
    out.push({
      lat: o.lat,
      lon: o.lon,
      t,
      segment: 0,
      alt: 100 + 10 * Math.sin(travelled / 900),
      accuracy: 6,
      speed: null,
    });
    const step = Math.max(0.3, SPEED[type] + gaussian(rand) * SPEED[type] * 0.12) * interval;
    heading = (heading + gaussian(rand) * (type === 'cycle' ? 6 : 10) + 360) % 360;
    if (travelled > km * 600) {
      const home = (Math.atan2(start.lon - pos.lon, start.lat - pos.lat) * 180) / Math.PI;
      heading += (((home - heading + 540) % 360) - 180) * 0.05;
    }
    pos = destination(pos, heading, step);
    travelled += step;
    t += interval * 1000;
  }
  return out;
}

export async function seedDemoHistory(
  c: Container,
  home: GeoPoint,
  days = 90,
  onProgress?: (done: number, total: number) => void
) {
  const rand = mulberry32(7);
  const kinds: { type: ActivityType; km: [number, number] }[] = [
    { type: 'walk', km: [1.5, 4] },
    { type: 'run', km: [4, 9] },
    { type: 'cycle', km: [10, 25] },
  ];
  const route = (i: number) => {
    const k = kinds[i % 3];
    return { type: k.type, km: k.km[0] + rand() * (k.km[1] - k.km[0]), seed: 1000 + Math.floor(rand() * 1e6) };
  };
  const favourites = Array.from({ length: 6 }, (_, i) => route(i));
  const weights = favourites.map((_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = rand() * total;
    for (let i = 0; i < favourites.length; i++) if ((r -= weights[i]) <= 0) return favourites[i];
    return favourites[0];
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plan: { r: ReturnType<typeof route>; start: number; noise: number }[] = [];
  for (let d = days; d >= 1; d--) {
    if (rand() > 4 / 7) continue;
    const r = rand() < 0.15 ? route(Math.floor(rand() * 3)) : pick();
    plan.push({
      r,
      start: today.getTime() - d * 86_400_000 + (6 + Math.floor(rand() * 13)) * 3_600_000,
      noise: Math.floor(rand() * 1e9),
    });
  }
  let done = 0;
  for (const p of plan) {
    const points = generateTrack(p.r.type, p.r.km, home, p.r.seed, p.noise, p.start);
    await c.activityLog.importActivity.execute({ id: `demo-${p.start}`, type: p.r.type, points });
    onProgress?.(++done, plan.length);
  }
  await c.dispatcher.dispatchPending();
  return plan.length;
}
