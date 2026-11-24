import type { ActivityType, Clock, GeoPoint } from '@/shared-kernel';

import type { PlannedRouteView, RoutingConsentState } from '../contract';
import { legLengthM, PlannedRoute, type WaypointAdded } from '../domain/planned-route';
import { DEFAULT_PLANNED_ROUTE_TYPE } from '../domain/planned-route.constants';
import type { PlannedRouteRepository } from '../domain/planned-route-repository';
import type { RoutingConsent, StreetRouter, TurfGainEstimator } from './ports';

export interface RoutePlanningDeps {
  routes: PlannedRouteRepository;
  router: StreetRouter;
  consent: RoutingConsent;
  turf: TurfGainEstimator;
  clock: Clock;
}

type Listener = (view: PlannedRouteView) => void;
/** What an edit did: whether it changed the route, and which legs to snap to streets. */
type Edit = { changed: boolean; snap: readonly number[] };
const added = (a: WaypointAdded): Edit => ({ changed: a.added, snap: a.leg == null ? [] : [a.leg] });

/**
 * Runs the edits of the Planned Route one at a time (a tap waits for the leg before it), so two
 * quick taps never start from the same stored route. Every committed edit is heard by the listeners.
 */
export class PlannedRouteEditor {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<Listener>();

  constructor(private readonly d: RoutePlanningDeps) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /**
   * Load → edit → save (the edit is kept even if routing fails or the app dies next) → snap the legs
   * the edit names, with consent → save → the fresh view.
   */
  edit(change: (route: PlannedRoute, now: number) => Edit): Promise<PlannedRouteView> {
    const run = this.tail.then(async () => {
      const now = this.d.clock.now();
      const stored = await this.d.routes.active();
      const route = stored ?? PlannedRoute.draft(DEFAULT_PLANNED_ROUTE_TYPE, now);
      const { changed, snap } = change(route, now);
      if (!changed) {
        return viewOf(route, this.d.turf, stored != null);
      }
      await this.d.routes.save(route);
      if (snap.length > 0 && (await this.snap(route, snap))) {
        await this.d.routes.save(route);
      }
      const view = await viewOf(route, this.d.turf, true);
      this.listeners.forEach((l) => {
        try {
          l(view);
        } catch {
          // A failing listener (a screen) never undoes a committed edit.
        }
      });
      return view;
    });
    this.tail = run.catch(() => undefined); // a failed edit must not block the ones behind it
    return run;
  }

  /**
   * Asks the router for the given legs, one request per run of consecutive legs, never without the
   * Turfer's consent. What it can't route stays straight. Returns whether a leg changed.
   */
  private async snap(route: PlannedRoute, legs: readonly number[]): Promise<boolean> {
    if ((await this.d.consent.state().catch(() => 'unasked')) !== 'granted') {
      return false;
    }
    let changed = false;
    for (const [first, last] of runsOf(legs)) {
      const waypoints = route.waypoints.slice(first, last + 2);
      const result = await this.d.router.route(waypoints, route.type).catch(() => null);
      if (result?.kind === 'unavailable') {
        break; // offline, rate limited or out of budget: the next run would fare no better
      }
      if (result?.kind !== 'routed' || result.legs.length !== waypoints.length - 1) {
        continue;
      }
      result.legs.forEach((path, i) => {
        const [from, to] = route.endsOf(first + i);
        changed = route.snapLeg(first + i, from, to, path, this.d.clock.now()) || changed;
      });
    }
    return changed;
  }
}

/** [first, last] of each run of consecutive leg indices. */
function runsOf(legs: readonly number[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const i of [...new Set(legs)].sort((a, b) => a - b)) {
    const run = runs[runs.length - 1];
    if (run && run[1] === i - 1) {
      run[1] = i;
    } else {
      runs.push([i, i]);
    }
  }
  return runs;
}

const lonLat = (p: GeoPoint): [number, number] => [p.lon, p.lat];

async function viewOf(
  route: PlannedRoute,
  turf: TurfGainEstimator,
  stored: boolean,
  estimate = true
): Promise<PlannedRouteView> {
  const line = route.line();
  const gain = estimate && line.length > 0 ? await turf.estimate(line) : { cells: [], newCells: [], newAreaM2: 0 };
  return {
    type: route.type,
    waypoints: route.waypoints.map((p) => ({ lat: p.lat, lon: p.lon })),
    legs: route.legs.map((l) => ({ coordinates: l.path.map(lonLat), snapped: l.snapped, distanceM: legLengthM(l) })),
    isLoop: route.isLoop,
    distanceM: route.distanceM,
    durationS: route.durationS,
    cellCount: gain.cells.length,
    newCellCount: gain.newCells.length,
    newAreaM2: gain.newAreaM2,
    newCells: gain.newCells,
    showOnRecord: route.showOnRecord,
    updatedAt: stored ? route.updatedAt : null,
  };
}

/** The Planned Route as it is now, with a fresh turf estimate (turf grows after every recording). */
export class GetActivePlannedRoute {
  constructor(private readonly d: RoutePlanningDeps) {}
  /** `estimate: false` leaves the turf estimate empty: the Record guide draws only the legs. */
  async execute(opts: { estimate?: boolean } = {}): Promise<PlannedRouteView> {
    const stored = await this.d.routes.active();
    const route = stored ?? PlannedRoute.draft(DEFAULT_PLANNED_ROUTE_TYPE, this.d.clock.now());
    return viewOf(route, this.d.turf, stored != null, opts.estimate ?? true);
  }
}

/** A tapped Waypoint; the leg to it is snapped to streets (with consent). DomainError past 30 Waypoints. */
export class AddWaypoint {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(point: GeoPoint): Promise<PlannedRouteView> {
    return this.editor.edit((r, now) => added(r.addWaypoint(point, now)));
  }
}

/** Removes the last Waypoint and its leg (no routing). */
export class UndoWaypoint {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(): Promise<PlannedRouteView> {
    return this.editor.edit((r, now) => ({ changed: r.removeLastWaypoint(now), snap: [] }));
  }
}

/** Removes every Waypoint (keeps the type); the Record map stops showing it. */
export class ClearPlannedRoute {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(): Promise<PlannedRouteView> {
    return this.editor.edit((r, now) => ({ changed: r.clear(now), snap: [] }));
  }
}

/** Back to the start: the first Waypoint again, its leg snapped. DomainError 'planned-route.loop-too-short' below 2. */
export class CloseLoop {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(): Promise<PlannedRouteView> {
    return this.editor.edit((r, now) => added(r.closeLoop(now)));
  }
}

/** Walk, run or cycle. Between foot and bike every leg is snapped again (one request). */
export class SetPlannedRouteType {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(type: ActivityType): Promise<PlannedRouteView> {
    return this.editor.edit((r, now) => {
      const before = r.type;
      const snap = r.changeType(type, now);
      return { changed: r.type !== before, snap };
    });
  }
}

/**
 * Snaps every leg still drawn straight (after the Turfer agreed to routing, or back online). Nothing
 * is sent without consent.
 */
export class SnapPlannedRoute {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(): Promise<PlannedRouteView> {
    return this.editor.edit((r) => {
      const snap = r.straightLegs();
      return { changed: snap.length > 0, snap };
    });
  }
}

/** "Use on Record" (true) or dismiss it from the Record map (false). DomainError 'planned-route.too-short' below 2 Waypoints. */
export class ShowPlannedRouteOnRecord {
  constructor(private readonly editor: PlannedRouteEditor) {}
  execute(shown: boolean): Promise<PlannedRouteView> {
    return this.editor.edit((r, now) => ({ changed: r.setShowOnRecord(shown, now), snap: [] }));
  }
}

/** Unasked until the Turfer answers the routing sheet; unasked and declined send nothing. */
export class GetRoutingConsent {
  constructor(private readonly d: Pick<RoutePlanningDeps, 'consent'>) {}
  execute(): Promise<RoutingConsentState> {
    return this.d.consent.state();
  }
}

/** The Turfer's answer (also the Info toggle). Granting doesn't snap by itself: SnapPlannedRoute does. */
export class SetRoutingConsent {
  constructor(private readonly d: Pick<RoutePlanningDeps, 'consent'>) {}
  execute(granted: boolean): Promise<void> {
    return this.d.consent.set(granted);
  }
}
