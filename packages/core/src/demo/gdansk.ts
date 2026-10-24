/**
 * Dev and demo data only: the Gdańsk demo history (demo@cityturfer.com). Four months of walks, runs
 * and rides along real Gdańsk streets (routes from apps/mobile/tools/gen-gdansk-routes.mjs), the
 * same on the phone (apps/mobile/src/dev/gdansk-demo.ts imports it through its use cases) and on the
 * local API (apps/api/src/dev/mock-accounts.ts uploads it like a phone backup). Pure: no I/O.
 */
import type { ActivityType, GeoPoint, TrackPoint } from '../shared-kernel';
import data from './gdansk-routes.json';
import { destination, gaussian, mulberry32 } from './random';

/** Activity ids of demo data start with this (the phone never backs them up from a device). */
export const DEMO_PREFIX = 'demo-';

export const DEMO_USER_ID = 'demo';
export const GDANSK_CITY_ID = 'pl-gdansk';
const DAYS = 120;
const PER_WEEK = 4.5;
const INTERVAL_S = 3;
const SPEED: Record<ActivityType, number> = { walk: 1.35, run: 2.9, cycle: 5.2 };
/** How often each favourite comes up, in the order of gdansk-routes.json. */
const WEIGHTS = [6, 3, 2, 2, 5, 2, 3, 2, 2];

export interface DemoRoute {
  name: string;
  type: ActivityType;
  distanceM: number;
  path: [number, number][];
}
const ROUTES = (data as unknown as { routes: DemoRoute[] }).routes;
/** The favourite routes, in the order of gdansk-routes.json. */
export const GDANSK_ROUTES: readonly DemoRoute[] = ROUTES;

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

/** A planned demo activity's id: its place in the plan, the same on every day (resumable). */
export const demoActivityId = (index: number) => `${DEMO_PREFIX}gdansk-n${index}`;

const PLAN_ID = /^demo-gdansk-n\d+$/;

/**
 * Is this the id of a planned Gdańsk demo activity (`demoActivityId`)? Only these are the demo
 * profile's content (LP3); every other `demo-…` id (the Developer tools seeder's tracks around the
 * phone's real position, legacy `demo-gdansk-<ms>` ids) is not.
 */
export const isGdanskPlanActivityId = (id: string): boolean => PLAN_ID.test(id);
export interface PlannedActivity {
  id: string;
  route: DemoRoute;
  start: number;
  seed: number;
  reverse: boolean;
}

/** The four months of activities, ending yesterday. Which ones, and their ids, never change. */
export function planGdanskDemo(today: number): PlannedActivity[] {
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
  const plan: PlannedActivity[] = [];
  for (let d = DAYS; d >= 1; d--) {
    if (d > 1 && rand() > PER_WEEK / 7) {
      continue; // always keep yesterday, so the dashboard has something fresh
    }
    const route = pick();
    const hour = route.type === 'cycle' ? 9 + Math.floor(rand() * 8) : 6 + Math.floor(rand() * 14);
    plan.push({
      id: demoActivityId(plan.length),
      route,
      start: today - d * 86_400_000 + hour * 3_600_000 + Math.floor(rand() * 60) * 60_000,
      seed: Math.floor(rand() * 1e9),
      reverse: rand() < 0.4,
    });
  }
  return plan;
}

/** The points of a planned activity: its route, walked in its direction, with its noise. */
export function pointsOf(p: PlannedActivity): TrackPoint[] {
  const path = p.reverse ? [...p.route.path].reverse() : p.route.path;
  return trackAlongPath(path, p.route.type, p.start, p.seed);
}
