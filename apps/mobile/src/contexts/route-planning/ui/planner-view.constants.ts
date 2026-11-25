import type { ReactNode } from 'react';

import { type BoundingBox, DomainError } from '@/shared-kernel';

import type { PlannedRouteView } from '../contract';

/** What the planner map shows: bounds ([west, south, east, north]) and zoom (to load the turf under it). */
export type PlannerMapView = { bbox: BoundingBox; zoom: number };

export type PlannerViewProps = {
  /** The active Planned Route, read before mounting (the camera's first view depends on it); null if it couldn't be read. */
  route: PlannedRouteView | null;
  /** The Home City's centre `[lon, lat]` (handed in by the screen), where the map opens without a plan. */
  cityCenter: [number, number] | null;
  /**
   * Map layers mounted after the planned route (the screen passes the Turfer's turf): they should use
   * `beforeId={PLANNED_ROUTE_BOTTOM_LAYER}` to sit under it, and stay mounted (empty) when hidden.
   */
  underlay?: ReactNode;
  /** Called whenever the map settles on a new view, so the underlay can load what's on screen. */
  onViewChange?: (view: PlannerMapView) => void;
};

/** A Waypoint tapped but not yet saved (drawn faintly until the edit lands). */
export type PendingWaypoint = { lat: number; lon: number };

export type PlannedRouteLayersProps = {
  route: PlannedRouteView | null;
  pending: readonly PendingWaypoint[];
};

export type PlannedRouteGuideProps = {
  route: PlannedRouteView | null;
  /** The layer the guide goes under (the Record map's live track). */
  beforeId?: string;
};

export type HideRouteChipProps = { onHide: () => void };

export type RoutingConsentSheetProps = {
  visible: boolean;
  onFollowStreets: () => void;
  onStraightLines: () => void;
  /** Closed without an answer (Android back): nothing is saved. */
  onDismiss: () => void;
};

/** The planned route's lowest layer (the new-cell outlines): the turf goes under it with `beforeId`. */
export const PLANNED_ROUTE_BOTTOM_LAYER = 'planned-cells-outline';

/** Zoom the planner opens at on a city or on the Turfer: streets are tappable. */
export const PLANNER_ZOOM = 15;

/** Room for the type chips at the top and the panel at the bottom when fitting a restored plan. */
export const PLAN_FIT_PADDING = { top: 90, bottom: 340, left: 40, right: 40 };

/** Map chips are about 36 pt tall: this makes them a 44 pt tap. */
export const PLANNER_CHIP_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

/** The `planner` messages a failed edit can show; never the error's own text. */
export type PlannerErrorKey =
  'errors.tooManyWaypoints' | 'errors.tooLong' | 'errors.loopTooShort' | 'errors.tooShort' | 'errors.generic';

const ERROR_KEY_OF_CODE: Record<string, PlannerErrorKey> = {
  'planned-route.too-many-waypoints': 'errors.tooManyWaypoints',
  'planned-route.too-long': 'errors.tooLong',
  'planned-route.loop-too-short': 'errors.loopTooShort',
  'planned-route.too-short': 'errors.tooShort',
};

/** Which message explains `e`: the Planned Route's own codes, else the generic one. */
export function plannerErrorKey(e: unknown): PlannerErrorKey {
  return (e instanceof DomainError && ERROR_KEY_OF_CODE[e.code]) || 'errors.generic';
}

/** Bounds `[west, south, east, north]` of everything the route draws; null without a Waypoint. */
export function routeBounds(route: PlannedRouteView | null): BoundingBox | null {
  if (!route || route.waypoints.length === 0) {
    return null;
  }
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  const add = (lon: number, lat: number) => {
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  };
  route.waypoints.forEach((p) => add(p.lon, p.lat));
  route.legs.forEach((l) => l.coordinates.forEach(([lon, lat]) => add(lon, lat)));
  return [w, s, e, n];
}

/** Planned time in whole minutes, split for the message ("1 h 05 min", "25 min"). */
export function plannedTime(durationS: number): { hours: number; minutes: number; totalMinutes: number } {
  const totalMinutes = Math.max(0, Math.round(durationS / 60));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60, totalMinutes };
}
