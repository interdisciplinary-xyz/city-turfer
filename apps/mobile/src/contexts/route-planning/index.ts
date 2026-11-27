// Public API of the Route Planning context: the Turfer's one active Planned Route (slice 1 of the
// route planner, docs/plans/route-planner-2026-11-24.md). Device-only: never backed up or synced.
import {
  AddWaypoint,
  ClearPlannedRoute,
  CloseLoop,
  GetActivePlannedRoute,
  GetRoutingConsent,
  PlannedRouteEditor,
  type RoutePlanningDeps,
  SetPlannedRouteType,
  SetRoutingConsent,
  ShowPlannedRouteOnRecord,
  SnapPlannedRoute,
  UndoWaypoint,
} from './application/use-cases';
import type { PlannedRouteView } from './contract';

export function createRoutePlanningApi(deps: RoutePlanningDeps) {
  const editor = new PlannedRouteEditor(deps);
  return {
    /** The Planned Route now (empty, `updatedAt: null`, before the first tap), turf estimate fresh. */
    active: new GetActivePlannedRoute(deps),
    addWaypoint: new AddWaypoint(editor),
    undo: new UndoWaypoint(editor),
    clear: new ClearPlannedRoute(editor),
    closeLoop: new CloseLoop(editor),
    setType: new SetPlannedRouteType(editor),
    /** Snaps the legs still straight (after consent, or back online). */
    snap: new SnapPlannedRoute(editor),
    /** "Use on Record" / dismiss: whether the Record map draws it. */
    showOnRecord: new ShowPlannedRouteOnRecord(editor),
    routingConsent: new GetRoutingConsent(deps),
    setRoutingConsent: new SetRoutingConsent(deps),
    /** The fresh view after every committed edit (e.g. the Record map's guide line). Returns unsubscribe. */
    subscribe: (listener: (view: PlannedRouteView) => void) => editor.subscribe(listener),
  };
}
export type RoutePlanningApi = ReturnType<typeof createRoutePlanningApi>;
export type {
  RoutingConsent,
  StreetRouter,
  StreetRouting,
  StreetRoutingUnavailable,
  TurfGainEstimator,
} from './application/ports';
export type { RoutePlanningDeps } from './application/use-cases';
export type * from './contract';
