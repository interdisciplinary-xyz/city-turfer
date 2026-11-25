import type { ActivityType, GeoPoint } from '@/shared-kernel';

import type { RoutingConsentState } from '../contract';

/** Why the router gave no path: the legs stay straight (and are still scored). */
export type StreetRoutingUnavailable = 'rate-limited' | 'offline' | 'timeout' | 'budget' | 'failed';

export type StreetRouting =
  /** One path per leg (`waypoints.length - 1`), each from the first Waypoint's street to the next. */
  | { kind: 'routed'; legs: GeoPoint[][] }
  /** The router found no way between these Waypoints. */
  | { kind: 'no-route' }
  | { kind: 'unavailable'; reason: StreetRoutingUnavailable };

/**
 * Port: routes through Waypoints in order, along the streets of the activity type. Never throws.
 * Called only with the Turfer's routing consent.
 */
export interface StreetRouter {
  route(waypoints: readonly GeoPoint[], type: ActivityType): Promise<StreetRouting>;
}

/** Port: the Turfer's opt-in to sending Waypoints to the street router (off until accepted). */
export interface RoutingConsent {
  state(): Promise<RoutingConsentState>;
  set(granted: boolean): Promise<void>;
}

/** Port: the turf a line would claim (Territory's estimate, on the phone). */
export interface TurfGainEstimator {
  estimate(line: readonly GeoPoint[]): Promise<{
    cells: string[];
    newCells: { id: string; ring: [number, number][] }[];
    newAreaM2: number;
  }>;
}
