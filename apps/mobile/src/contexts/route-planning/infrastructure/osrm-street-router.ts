import {
  OSM_ROUTING_BASE_URL,
  OSM_ROUTING_DECIMALS,
  OSM_ROUTING_PROFILE,
  OSM_ROUTING_TIMEOUT_MS,
  osmRoutingHeaders,
} from '@/constants/routing';
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
  wait?: (ms: number) => Promise<void>;
}

/**
 * Snaps a Planned Route's Waypoints to streets with the FOSSGIS OSRM server (constants/routing.ts),
 * one request through all the Waypoints it is given. Only the Waypoints leave the phone, rounded to 4
 * decimals; the app identifies itself as the usage policy asks; paced by a StreetRouterBudget. Never
 * throws: 400 or no route → 'no-route'; 429, offline, timeout, budget or a bad answer → 'unavailable'.
 * The application calls it only with the Turfer's consent.
 */
export class OsrmStreetRouter implements StreetRouter {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly headers: Record<string, string>;
  private readonly budget: StreetRouterBudget;

  constructor(o: OsrmStreetRouterOptions) {
    this.fetch = o.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = o.timeoutMs ?? OSM_ROUTING_TIMEOUT_MS;
    this.now = o.now ?? Date.now;
    this.headers = osmRoutingHeaders(o.appVersion);
    this.budget = new StreetRouterBudget(
      this.now,
      o.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    );
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
    if (!(await this.budget.take())) {
      return { kind: 'unavailable', reason: 'budget' };
    }
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
        this.budget.offline();
        return { kind: 'unavailable', reason: 'offline' };
      }
      if (res.status === 400) {
        return { kind: 'no-route' }; // e.g. a Waypoint no street reaches
      }
      if (res.status === 429) {
        this.budget.rateLimited(this.retryAfterMs(res.headers.get('Retry-After')));
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

  /** Retry-After is either delay-seconds or an HTTP date. */
  private retryAfterMs(header: string | null): number | null {
    if (!header) {
      return null;
    }
    const s = Number(header);
    if (Number.isFinite(s)) {
      return Math.max(0, s * 1000);
    }
    const at = Date.parse(header);
    return Number.isNaN(at) ? null : Math.max(0, at - this.now());
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
