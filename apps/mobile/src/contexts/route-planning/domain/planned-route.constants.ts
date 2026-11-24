import type { ActivityType } from '@/shared-kernel';

/**
 * Typical moving speed (m/s) a Planned Route's estimated time assumes: about 5 km/h walking,
 * 10.8 km/h running, 18 km/h cycling (the speeds the turf parity generator moves at). An estimate for
 * the planner card only, never a tracking threshold.
 */
export const PLANNING_SPEED_MPS: Record<ActivityType, number> = { walk: 1.4, run: 3.0, cycle: 5.0 };

/** The streets a type moves on: walk and run share the footways, cycle rides the cycle network. */
export const TRAVEL_MODE: Record<ActivityType, 'foot' | 'bike'> = { walk: 'foot', run: 'foot', cycle: 'bike' };

/** At most this many Waypoints on one Planned Route (a tap route, not a route library). */
export const MAX_WAYPOINTS = 30;

/** The type a new Planned Route starts with until the Turfer picks another. */
export const DEFAULT_PLANNED_ROUTE_TYPE: ActivityType = 'walk';
