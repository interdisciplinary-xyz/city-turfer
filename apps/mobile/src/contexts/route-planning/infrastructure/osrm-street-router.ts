import {
  OSM_ROUTING_BASE_URL,
  OSM_ROUTING_DECIMALS,
  OSM_ROUTING_PROFILE,
  OSM_ROUTING_TIMEOUT_MS,
  osmRoutingHeaders,
} from '@/constants/routing';
import { OsmRouterGate, retryAfterMs } from '@/platform/osm-router-gate';
import type { ActivityType, GeoPoint } from '@/shared-kernel';

import type { StreetRouter, StreetRouting } from '../application/ports';
import { StreetRouterBudget } from './street-router-budget';

const coord = (p: GeoPoint) => `${p.lon.toFixed(OSM_ROUTING_DECIMALS)},${p.lat.toFixed(OSM_ROUTING_DECIMALS)}`;

interface OsrmBody {
  code?: string;
  routes?: { legs?: { steps?: { geometry?: { coordinates?: unknown } }[] }[] }[];
}

export interface OsrmStreetRouterOptions {
  appVersion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  /** The app-wide gate to the OSM router, shared with Activity Log's gap estimates. */
  gate?: OsmRouterGate;
  /** Only for the gate made when none is given (tests). */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Snaps a Planned Route's Waypoints to streets with the FOSSGIS OSRM server (constants/routing.ts),
 * one request through all the Waypoints it is given. Only the Waypoints leave the phone, rounded to 4
 * decimals; the app identifies itself as the usage policy asks; paced by the app-wide OsmRouterGate
 * and capped by a StreetRouterBudget. Never throws: 400 or no route → 'no-route'; 429, offline,
 * timeout, budget (or the gate paused) or a bad answer → 'unavailable'.
 * The application calls it only with the Turfer's consent.
 */
export class OsrmStreetRouter implements StreetRouter {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly headers: Record<string, string>;
  private readonly budget: StreetRouterBudget;
  private readonly gate: OsmRouterGate;

  constructor(o: OsrmStreetRouterOptions) {
    this.fetch = o.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = o.timeoutMs ?? OSM_ROUTING_TIMEOUT_MS;
    this.now = o.now ?? Date.now;
    this.headers = osmRoutingHeaders(o.appVersion);
    this.budget = new StreetRouterBudget(this.now);
    this.gate = o.gate ?? new OsmRouterGate(this.now, o.wait);
  }

  /** Steps carry each leg's geometry (the overview would be one line for the whole route). */
  static urlFor(waypoints: readonly GeoPoint[], type: ActivityType): string {
    const coords = waypoints.map(coord).join(';');
    return `${OSM_ROUTING_BASE_URL}/${OSM_ROUTING_PROFILE[type]}/route/v1/driving/${coords}?overview=false&steps=true&geometries=geojson`;
  }

  async route(waypoints: readonly GeoPoint[], type: ActivityType): Promise<StreetRouting> {
    if (waypoints.length < 2) {
      return { kind: 'no-route' };
    }
    if (!this.budget.hasRoom() || !(await this.gate.acquire()).go) {
      return { kind: 'unavailable', reason: 'budget' }; // window spent, or the router paused for the app
    }
    this.budget.record();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      let res: Response;
      try {
        res = await this.fetch(OsrmStreetRouter.urlFor(waypoints, type), {
          signal: ctrl.signal,
          headers: this.headers,
        });
      } catch {
        if (ctrl.signal.aborted) {
          return { kind: 'unavailable', reason: 'timeout' };
        }
        this.gate.offline();
        return { kind: 'unavailable', reason: 'offline' };
      }
      if (res.status === 400) {
        return { kind: 'no-route' }; // e.g. a Waypoint no street reaches
      }
      if (res.status === 429) {
        this.gate.rateLimited(retryAfterMs(res.headers.get('Retry-After'), this.now()));
        return { kind: 'unavailable', reason: 'rate-limited' };
      }
      if (!res.ok) {
        return { kind: 'unavailable', reason: 'failed' };
      }
      const body = (await res.json()) as OsrmBody;
      if (body.code !== 'Ok' || !body.routes?.[0]) {
        return { kind: 'no-route' };
      }
      const legs = (body.routes[0].legs ?? []).map(pathOf);
      if (legs.length !== waypoints.length - 1 || legs.some((l) => l == null)) {
        return { kind: 'unavailable', reason: 'failed' };
      }
      return { kind: 'routed', legs: legs as GeoPoint[][] };
    } catch {
      return { kind: 'unavailable', reason: ctrl.signal.aborted ? 'timeout' : 'failed' };
    } finally {
      clearTimeout(timer);
    }
  }
}

const isLonLat = (c: unknown): c is [number, number] =>
  Array.isArray(c) &&
  Number.isFinite(c[0]) &&
  Number.isFinite(c[1]) &&
  Math.abs(c[0] as number) <= 180 &&
  Math.abs(c[1] as number) <= 90;

/** A leg's path from its steps' lines, joined without repeating the shared points. Null if unusable. */
function pathOf(leg: { steps?: { geometry?: { coordinates?: unknown } }[] }): GeoPoint[] | null {
  const path: GeoPoint[] = [];
  for (const step of leg.steps ?? []) {
    const coords = step.geometry?.coordinates;
    if (!Array.isArray(coords) || !coords.every(isLonLat)) {
      return null;
    }
    for (const [lon, lat] of coords) {
      const last = path[path.length - 1];
      if (!last || last.lat !== lat || last.lon !== lon) {
        path.push({ lat, lon });
      }
    }
  }
  if (path.length === 0) {
    return null;
  }
  return path.length === 1 ? [path[0], path[0]] : path;
}
