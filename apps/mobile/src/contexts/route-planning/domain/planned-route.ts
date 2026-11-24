import { type ActivityType, distanceM, DomainError, type GeoPoint, geoPoint } from '@/shared-kernel';

import { MAX_ROUTE_M, MAX_WAYPOINTS, PLANNING_SPEED_MPS, TRAVEL_MODE } from './planned-route.constants';

/**
 * A Route Leg: the way from one Waypoint to the next. Snapped: along streets (the router's path);
 * straight: a direct line (no consent, offline, rate limited or no route), still scored.
 */
export interface RouteLeg {
  readonly path: readonly GeoPoint[];
  readonly snapped: boolean;
}

export interface PlannedRouteState {
  readonly type: ActivityType;
  readonly waypoints: readonly GeoPoint[];
  /** legs[i] runs from waypoints[i] to waypoints[i + 1]: one fewer than the Waypoints (none for 0 or 1). */
  readonly legs: readonly RouteLeg[];
  /** The Record map draws it as a guide line. Only a route (2+ Waypoints) can be shown. */
  readonly showOnRecord: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Whether a Waypoint was added, and the index of the new leg to snap (none for the first Waypoint). */
export interface WaypointAdded {
  readonly added: boolean;
  readonly leg: number | null;
}

const samePoint = (a: GeoPoint, b: GeoPoint) => a.lat === b.lat && a.lon === b.lon;
const straight = (from: GeoPoint, to: GeoPoint): RouteLeg => ({ path: [from, to], snapped: false });
/** A leg's length as drawn, metres (shared-kernel haversine). */
/** Length of the straight lines through `w`, in metres (what MAX_ROUTE_M bounds). */
function straightLengthM(w: readonly GeoPoint[]): number {
  return w.slice(1).reduce((m, p, i) => m + distanceM(w[i], p), 0);
}

export function legLengthM(leg: RouteLeg): number {
  let m = 0;
  for (let i = 1; i < leg.path.length; i++) {
    m += distanceM(leg.path[i - 1], leg.path[i]);
  }
  return m;
}
const valid = (p: GeoPoint) => geoPoint(p.lat, p.lon);

/**
 * Aggregate: the Turfer's one active Planned Route, an intention drawn on the map (never turf: only
 * moving claims cells). Waypoints are tapped in order; each new Waypoint adds a straight Route Leg that
 * the application may later snap to streets. Pure, SI units (metres, seconds).
 */
export class PlannedRoute {
  private constructor(private state: PlannedRouteState) {}

  /** An empty Planned Route of a type (nothing tapped yet). */
  static draft(type: ActivityType, now: number): PlannedRoute {
    return new PlannedRoute({ type, waypoints: [], legs: [], showOnRecord: false, createdAt: now, updatedAt: now });
  }

  /** Repository only. Rejects a stored state whose legs don't join its Waypoints. */
  static rehydrate(state: PlannedRouteState): PlannedRoute {
    const { waypoints, legs } = state;
    if (legs.length !== Math.max(0, waypoints.length - 1) || legs.some((l) => l.path.length < 2)) {
      throw new DomainError('planned-route.corrupt');
    }
    if (state.showOnRecord && waypoints.length < 2) {
      throw new DomainError('planned-route.corrupt');
    }
    return new PlannedRoute(state);
  }

  toState(): Readonly<PlannedRouteState> {
    return this.state;
  }

  get type(): ActivityType {
    return this.state.type;
  }
  get waypoints(): readonly GeoPoint[] {
    return this.state.waypoints;
  }
  get legs(): readonly RouteLeg[] {
    return this.state.legs;
  }
  get showOnRecord(): boolean {
    return this.state.showOnRecord;
  }
  get updatedAt(): number {
    return this.state.updatedAt;
  }

  /** Back where it started: 3+ Waypoints and the last one is the first. */
  get isLoop(): boolean {
    const w = this.state.waypoints;
    return w.length >= 3 && samePoint(w[0], w[w.length - 1]);
  }

  /** Along every leg as drawn (snapped or straight), in metres. */
  get distanceM(): number {
    return this.state.legs.reduce((m, l) => m + legLengthM(l), 0);
  }

  /** Estimated moving time at the type's typical speed, in whole seconds. */
  get durationS(): number {
    return Math.round(this.distanceM / PLANNING_SPEED_MPS[this.state.type]);
  }

  /** Every leg's path end to end: the line the turf estimate scores. Empty without a leg. */
  line(): GeoPoint[] {
    return this.state.legs.flatMap((l) => l.path);
  }

  /** The two Waypoints a leg joins. */
  endsOf(leg: number): [GeoPoint, GeoPoint] {
    const w = this.state.waypoints;
    if (!Number.isInteger(leg) || leg < 0 || leg >= this.state.legs.length) {
      throw new DomainError('planned-route.no-such-leg', String(leg));
    }
    return [w[leg], w[leg + 1]];
  }

  /** The legs still drawn straight, in order. */
  straightLegs(): number[] {
    return this.state.legs.flatMap((l, i) => (l.snapped ? [] : [i]));
  }

  /**
   * Appends a Waypoint; from the second one on, a straight leg to it, whose index it returns (to
   * snap). A tap on the last Waypoint is ignored (`added: false`).
   */
  addWaypoint(p: GeoPoint, now: number): WaypointAdded {
    const point = valid(p);
    const w = this.state.waypoints;
    const last = w[w.length - 1];
    if (last && samePoint(last, point)) {
      return { added: false, leg: null };
    }
    if (w.length >= MAX_WAYPOINTS) {
      throw new DomainError('planned-route.too-many-waypoints', String(MAX_WAYPOINTS));
    }
    if (last && straightLengthM(w) + distanceM(last, point) > MAX_ROUTE_M) {
      throw new DomainError('planned-route.too-long', String(MAX_ROUTE_M));
    }
    const legs = last ? [...this.state.legs, straight(last, point)] : this.state.legs;
    this.state = { ...this.state, waypoints: [...w, point], legs, updatedAt: now };
    return { added: true, leg: last ? legs.length - 1 : null };
  }

  /** Removes the last Waypoint and its leg. False when there was none. Below two, it leaves Record. */
  removeLastWaypoint(now: number): boolean {
    const w = this.state.waypoints;
    if (w.length === 0) {
      return false;
    }
    const waypoints = w.slice(0, -1);
    this.state = {
      ...this.state,
      waypoints,
      legs: this.state.legs.slice(0, Math.max(0, waypoints.length - 1)),
      showOnRecord: this.state.showOnRecord && waypoints.length >= 2,
      updatedAt: now,
    };
    return true;
  }

  /** Removes every Waypoint (the type stays). False when already empty. */
  clear(now: number): boolean {
    if (this.state.waypoints.length === 0) {
      return false;
    }
    this.state = { ...this.state, waypoints: [], legs: [], showOnRecord: false, updatedAt: now };
    return true;
  }

  /**
   * Closes the loop: the first Waypoint again at the end, and the leg to it. `added: false` when the
   * route already ends where it starts. Needs 2+ Waypoints.
   */
  closeLoop(now: number): WaypointAdded {
    const w = this.state.waypoints;
    if (w.length < 2) {
      throw new DomainError('planned-route.loop-too-short');
    }
    if (samePoint(w[0], w[w.length - 1])) {
      return { added: false, leg: null };
    }
    return this.addWaypoint(w[0], now);
  }

  /**
   * Changes the activity type. When the streets change with it (foot ↔ bike) every leg is drawn
   * straight again, to be snapped for the new type; returns the legs to snap (none otherwise).
   */
  changeType(type: ActivityType, now: number): number[] {
    if (type === this.state.type) {
      return [];
    }
    const sameStreets = TRAVEL_MODE[type] === TRAVEL_MODE[this.state.type];
    const legs = sameStreets
      ? this.state.legs
      : this.state.legs.map((l, i) => straight(this.state.waypoints[i], this.state.waypoints[i + 1]));
    this.state = { ...this.state, type, legs, updatedAt: now };
    return sameStreets ? [] : legs.map((_, i) => i);
  }

  /**
   * Draws a leg along streets. Applied only while the leg still joins `from` and `to` (a result for
   * a leg since undone or re-tapped is dropped). Returns whether it was applied.
   */
  snapLeg(leg: number, from: GeoPoint, to: GeoPoint, path: readonly GeoPoint[], now: number): boolean {
    if (leg < 0 || leg >= this.state.legs.length || path.length < 2) {
      return false;
    }
    const [a, b] = this.endsOf(leg);
    if (!samePoint(a, from) || !samePoint(b, to)) {
      return false;
    }
    const snapped: RouteLeg = { path: path.map(valid), snapped: true };
    this.state = {
      ...this.state,
      legs: this.state.legs.map((l, i) => (i === leg ? snapped : l)),
      updatedAt: now,
    };
    return true;
  }

  /** Makes it the guide line on the Record map, or takes it off. Showing needs 2+ Waypoints. */
  setShowOnRecord(shown: boolean, now: number): boolean {
    if (shown === this.state.showOnRecord) {
      return false;
    }
    if (shown && this.state.waypoints.length < 2) {
      throw new DomainError('planned-route.too-short');
    }
    this.state = { ...this.state, showOnRecord: shown, updatedAt: now };
    return true;
  }
}
