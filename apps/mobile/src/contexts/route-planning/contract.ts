// Published language of the Route Planning context (types only): the Planned Route as screens see it.
import type { ActivityType } from '@/shared-kernel';

/** Whether Waypoints may be sent to the street router. Unasked counts as no (opt-in). */
export type RoutingConsentState = 'unasked' | 'granted' | 'declined';

/** A Route Leg, GeoJSON-ready: a LineString's coordinates `[lon, lat]`. */
export interface RouteLegView {
  coordinates: [number, number][];
  /** Along streets; false: a straight line ("Not snapped to streets"), still scored. */
  snapped: boolean;
  distanceM: number;
}

/** A Turf Cell the route would add to the Turfer's turf, with its closed outline `[lon, lat]`. */
export interface PlannedCellView {
  id: string;
  ring: [number, number][];
}

export interface PlannedRouteView {
  type: ActivityType;
  /** In tap order; a closed loop repeats the first at the end. */
  waypoints: { lat: number; lon: number }[];
  /** legs[i] joins waypoints[i] and waypoints[i + 1]. */
  legs: RouteLegView[];
  isLoop: boolean;
  /** Along every leg as drawn, metres. */
  distanceM: number;
  /** At the type's typical speed, seconds. */
  durationS: number;
  /** Cells along the route (estimate, by the claim rule). */
  cellCount: number;
  /** Of those, the cells the Turfer doesn't hold yet. */
  newCellCount: number;
  newAreaM2: number;
  /** The new cells, to outline on the map. */
  newCells: PlannedCellView[];
  /** The Record map draws it as a guide line. */
  showOnRecord: boolean;
  /** Last change (epoch ms); null: nothing planned yet. */
  updatedAt: number | null;
}
