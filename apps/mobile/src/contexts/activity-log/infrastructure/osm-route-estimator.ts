import { type RouteEstimator, RouterRateLimited, RouterUnreachable } from '@cityturfer/core/activity-log';

import {
  OSM_ROUTING_BASE_URL,
  OSM_ROUTING_DECIMALS,
  OSM_ROUTING_PROFILE,
  OSM_ROUTING_TIMEOUT_MS,
  osmRoutingHeaders,
} from '@/constants/routing';
import { OsmRouterGate, retryAfterMs } from '@/platform/osm-router-gate';
import type { ActivityType, GeoPoint } from '@/shared-kernel';

/**
 * FOSSGIS OpenStreetMap routing (OSRM, constants/routing.ts). Receives only the two endpoints of a
 * gap, rounded to 4 decimals (~10 m), never a whole track. Identifies the app as the usage policy
 * asks. Every request passes the app-wide OsmRouterGate (shared with Route Planning): a second
 * apart, and none while a 429 or an offline error seen by either feature pauses the router. Fine for
 * the PoC; production needs its own router.
 */
const coord = (p: GeoPoint) => `${p.lon.toFixed(OSM_ROUTING_DECIMALS)},${p.lat.toFixed(OSM_ROUTING_DECIMALS)}`;

export interface OsmRouteEstimatorOptions {
  appVersion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  /** The app-wide gate to the OSM router, shared with Route Planning's street snapping. */
  gate?: OsmRouterGate;
  /** Only for the gate made when none is given (tests). */
  wait?: (ms: number) => Promise<void>;
}

export class OsmRouteEstimator implements RouteEstimator {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly headers: Record<string, string>;
  private readonly gate: OsmRouterGate;

  constructor(o: OsmRouteEstimatorOptions) {
    this.fetch = o.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = o.timeoutMs ?? OSM_ROUTING_TIMEOUT_MS;
    this.now = o.now ?? Date.now;
    this.headers = osmRoutingHeaders(o.appVersion);
    this.gate = o.gate ?? new OsmRouterGate(this.now, o.wait);
  }

  static urlFor(from: GeoPoint, to: GeoPoint, type: ActivityType): string {
    return `${OSM_ROUTING_BASE_URL}/${OSM_ROUTING_PROFILE[type]}/route/v1/driving/${coord(from)};${coord(to)}?overview=full&geometries=geojson`;
  }

  async route(from: GeoPoint, to: GeoPoint, type: ActivityType) {
    const turn = await this.gate.acquire();
    if (!turn.go) {
      throw new RouterRateLimited(turn.pausedMs); // paused for the app: the gap budget waits it out
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      let res: Response;
      try {
        res = await this.fetch(OsmRouteEstimator.urlFor(from, to, type), {
          signal: ctrl.signal,
          headers: this.headers,
        });
      } catch (e) {
        if (ctrl.signal.aborted) {
          throw new Error('router timeout', { cause: e });
        } // slow service: this gap failed
        this.gate.offline();
        throw new RouterUnreachable(String((e as Error)?.message ?? e)); // no connection at all
      }
      if (res.status === 400) {
        return null;
      } // e.g. no route / point not routable
      if (res.status === 429) {
        const ms = retryAfterMs(res.headers.get('Retry-After'), this.now());
        this.gate.rateLimited(ms);
        throw new RouterRateLimited(ms);
      }
      if (!res.ok) {
        throw new Error(`router ${res.status}`);
      }
      const body = (await res.json()) as {
        code: string;
        routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
      };
      const r = body.code === 'Ok' ? body.routes?.[0] : undefined;
      return r ? { distanceM: r.distance, coords: r.geometry.coordinates } : null;
    } finally {
      clearTimeout(timer);
    }
  }
}
