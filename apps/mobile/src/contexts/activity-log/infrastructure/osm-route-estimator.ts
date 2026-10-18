import type { ActivityType, GeoPoint } from '@/shared-kernel';

import { type RouteEstimator, RouterRateLimited, RouterUnreachable } from '../application/use-cases';

/**
 * FOSSGIS OpenStreetMap routing (OSRM). Receives only the two endpoints of a
 * gap, rounded to 4 decimals (~10 m), never a whole track. Identifies the app
 * as the usage policy asks. Fine for the PoC; production needs its own router.
 */
const PROFILE: Record<ActivityType, string> = { walk: 'routed-foot', run: 'routed-foot', cycle: 'routed-bike' };
const BASE = 'https://routing.openstreetmap.de';
export const PROJECT_URL = 'https://github.com/interdisciplinary-xyz/city-turfer';
const TIMEOUT_MS = 10_000;

/** 4 decimals of a degree: about 11 m of latitude. Enough to route, too coarse to pinpoint a door. */
const coord = (p: GeoPoint) => `${p.lon.toFixed(4)},${p.lat.toFixed(4)}`;

export interface OsmRouteEstimatorOptions {
  appVersion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

export class OsmRouteEstimator implements RouteEstimator {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly headers: Record<string, string>;

  constructor(o: OsmRouteEstimatorOptions) {
    this.fetch = o.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = o.timeoutMs ?? TIMEOUT_MS;
    this.now = o.now ?? Date.now;
    this.headers = {
      'User-Agent': `CityTurfer/${o.appVersion} (+${PROJECT_URL})`,
      Referer: PROJECT_URL,
      Accept: 'application/json',
    };
  }

  static urlFor(from: GeoPoint, to: GeoPoint, type: ActivityType): string {
    return `${BASE}/${PROFILE[type]}/route/v1/driving/${coord(from)};${coord(to)}?overview=full&geometries=geojson`;
  }

  async route(from: GeoPoint, to: GeoPoint, type: ActivityType) {
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
        throw new RouterUnreachable(String((e as Error)?.message ?? e)); // no connection at all
      }
      if (res.status === 400) {
        return null;
      } // e.g. no route / point not routable
      if (res.status === 429) {
        throw new RouterRateLimited(this.retryAfterMs(res.headers.get('Retry-After')));
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
