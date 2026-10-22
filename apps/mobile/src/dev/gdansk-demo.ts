/**
 * Dev-only: the Gdańsk demo account (demo@cityturfer.com). Its first sign-in
 * fills its own database with four months of walks, runs and rides along real
 * Gdańsk streets (routes from tools/gen-gdansk-routes.mjs) and picks Gdańsk as
 * Home City, so the app can be screenshotted without anyone's real location.
 * Everything goes through the normal use cases, so turf is claimed as usual.
 */
import type { Container } from '@/composition-root';
import type { User } from '@/contexts/identity';
import type { ActivityType, GeoPoint, TrackPoint } from '@/shared-kernel';

import { DEMO_PREFIX, destination, gaussian, mulberry32 } from './demo-history';
import data from './gdansk-routes.json';

export const DEMO_USER_ID = 'demo';
const CITY_ID = 'pl-gdansk';
const DAYS = 120;
const PER_WEEK = 4.5;
const INTERVAL_S = 3;
const SPEED: Record<ActivityType, number> = { walk: 1.35, run: 2.9, cycle: 5.2 };
/** How often each favourite comes up, in the order of gdansk-routes.json. */
const WEIGHTS = [6, 3, 2, 2, 5, 2, 3, 2, 2];

interface DemoRoute {
  name: string;
  type: ActivityType;
  distanceM: number;
  path: [number, number][];
}
const ROUTES = (data as unknown as { routes: DemoRoute[] }).routes;

/** Walk a street path at a natural speed, one fix every few seconds, with GPS-like noise. */
export function trackAlongPath(
  path: readonly [number, number][],
  type: ActivityType,
  startTime: number,
  seed: number
): TrackPoint[] {
  const rand = mulberry32(seed);
  const pts: GeoPoint[] = path.map(([lat, lon]) => ({ lat, lon }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + metres(pts[i - 1], pts[i]));
  }
  const total = cum[cum.length - 1];
  const phi = Math.pow(0.95, INTERVAL_S);
  const innov = Math.sqrt(1 - phi * phi);
  const pace = SPEED[type] * (0.9 + rand() * 0.2); // some days are faster than others
  const out: TrackPoint[] = [];
  let s = 0,
    i = 0,
    t = startTime,
    east = 0,
    north = 0;
  for (;;) {
    while (i < pts.length - 2 && cum[i + 1] < s) {
      i++;
    }
    const segLen = cum[i + 1] - cum[i];
    const f = segLen > 0 ? Math.min(1, (s - cum[i]) / segLen) : 0;
    const p = {
      lat: pts[i].lat + (pts[i + 1].lat - pts[i].lat) * f,
      lon: pts[i].lon + (pts[i + 1].lon - pts[i].lon) * f,
    };
    east = phi * east + innov * gaussian(rand) * 3;
    north = phi * north + innov * gaussian(rand) * 3;
    const off = Math.hypot(east, north);
    const o = off > 0 ? destination(p, (Math.atan2(east, north) * 180) / Math.PI, off) : p;
    out.push({ lat: o.lat, lon: o.lon, t, segment: 0, alt: 12 + 8 * Math.sin(s / 700), accuracy: 5, speed: null });
    if (s >= total) {
      return out;
    }
    s = Math.min(total, s + Math.max(0.4, pace + gaussian(rand) * pace * 0.1) * INTERVAL_S);
    t += INTERVAL_S * 1000;
  }
}

function metres(a: GeoPoint, b: GeoPoint): number {
  const k = Math.PI / 180;
  const x = (b.lon - a.lon) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  const y = (b.lat - a.lat) * k;
  return Math.hypot(x, y) * 6_371_008.8;
}

/** Import four months of Gdańsk activities (idempotent per day) and set Gdańsk as Home City. */
export async function seedGdanskDemo(c: Container, onProgress?: (done: number, total: number) => void) {
  const rand = mulberry32(54);
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = rand() * total;
    for (let i = 0; i < ROUTES.length; i++) {
      if ((r -= WEIGHTS[i] ?? 1) <= 0) {
        return ROUTES[i];
      }
    }
    return ROUTES[0];
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plan: { route: DemoRoute; start: number; seed: number; reverse: boolean }[] = [];
  for (let d = DAYS; d >= 1; d--) {
    if (d > 1 && rand() > PER_WEEK / 7) {
      continue; // always keep yesterday, so the dashboard has something fresh
    }
    const route = pick();
    const hour = route.type === 'cycle' ? 9 + Math.floor(rand() * 8) : 6 + Math.floor(rand() * 14);
    plan.push({
      route,
      start: today.getTime() - d * 86_400_000 + hour * 3_600_000 + Math.floor(rand() * 60) * 60_000,
      seed: Math.floor(rand() * 1e9),
      reverse: rand() < 0.4,
    });
  }
  await c.territory.chooseHomeCity.execute(CITY_ID);
  let done = 0;
  for (const p of plan) {
    const path = p.reverse ? [...p.route.path].reverse() : p.route.path;
    const points = trackAlongPath(path, p.route.type, p.start, p.seed);
    await c.activityLog.importActivity.execute({ id: `${DEMO_PREFIX}gdansk-${p.start}`, type: p.route.type, points });
    onProgress?.(++done, plan.length);
  }
  await c.dispatcher.dispatchPending();
  return plan.length;
}

/** Called after every sign-in: fills the demo account the first time it is used. */
export async function prepareDemoAccount(user: User, c: Container): Promise<void> {
  if (user.id !== DEMO_USER_ID) {
    return;
  }
  const [home, latest] = await Promise.all([c.territory.homeCity.execute(), c.activityLog.list.execute(1)]);
  if (home?.id === CITY_ID && latest.length > 0) {
    return;
  }
  await seedGdanskDemo(c);
}
