import type { ActivityType, GeoPoint } from '@/shared-kernel';

import type { RouteEstimator } from '../application/useCases';

/**
 * FOSSGIS OpenStreetMap routing (OSRM). Receives only the two endpoints of a
 * gap, never a whole track. Fine for the PoC; production needs its own router.
 */
const PROFILE: Record<ActivityType, string> = { walk: 'routed-foot', run: 'routed-foot', cycle: 'routed-bike' };
const BASE = 'https://routing.openstreetmap.de';
const TIMEOUT_MS = 10_000;

export class OsmRouteEstimator implements RouteEstimator {
  async route(from: GeoPoint, to: GeoPoint, type: ActivityType) {
    const url =
      `${BASE}/${PROFILE[type]}/route/v1/driving/${from.lon.toFixed(6)},${from.lat.toFixed(6)};` +
      `${to.lon.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.status === 400) return null; // e.g. no route / point not routable
      if (!res.ok) throw new Error(`router ${res.status}`);
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
