import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ActivityType, GeoPoint } from '@/shared-kernel';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { PlannedRouteView, RoutingConsentState } from '../contract';

/** Screens showing the routing consent (planner sheet, Info toggle), told directly after a change. */
const consentListeners = new Set<(state: RoutingConsentState) => void>();

/** Newer wins: a read that started before an edit landed must not put the older route back. */
const newer = (cur: PlannedRouteView | null | undefined, next: PlannedRouteView): PlannedRouteView =>
  cur && next.updatedAt != null && cur.updatedAt != null && cur.updatedAt > next.updatedAt ? cur : next;

/**
 * The active Planned Route: `undefined` while loading, `null` if it couldn't be read. Hears every
 * committed edit (planner, Record's "Hide route"), and re-reads when the screen comes into view and
 * when stored data changes (the turf estimate grows after every recording).
 */
export function usePlannedRoute(opts: { estimate?: boolean } = {}): PlannedRouteView | null | undefined {
  const estimate = opts.estimate ?? true;
  const c = useContainer();
  const { dataVersion } = useApp();
  const [view, setView] = useState<PlannedRouteView | null | undefined>(undefined);
  useEffect(() => c.routePlanning.subscribe((v) => setView((cur) => newer(cur, v))), [c]);
  const read = useCallback(() => {
    let live = true;
    c.routePlanning.active.execute({ estimate }).then(
      (v) => live && setView((cur) => newer(cur, v)),
      () => live && setView((cur) => cur ?? null)
    );
    return () => {
      live = false;
    };
  }, [c, estimate]);
  useEffect(read, [read, dataVersion]);
  useFocusEffect(read);
  return view;
}

/** The planner's edits; each resolves to the fresh route and rejects with a DomainError the screen explains. */
export function usePlannerActions() {
  const c = useContainer();
  return useMemo(() => {
    const api = c.routePlanning;
    return {
      add: (p: GeoPoint) => api.addWaypoint.execute(p),
      undo: () => api.undo.execute(),
      clear: () => api.clear.execute(),
      closeLoop: () => api.closeLoop.execute(),
      setType: (type: ActivityType) => api.setType.execute(type),
      snap: () => api.snap.execute(),
      showOnRecord: (shown: boolean) => api.showOnRecord.execute(shown),
    };
  }, [c]);
}

/**
 * Whether Waypoints may go to the street router: `undefined` while loading. Setting it tells every
 * screen showing it; granting also snaps the legs still drawn straight.
 */
export function useRoutingConsent(): [RoutingConsentState | undefined, (granted: boolean) => Promise<void>] {
  const c = useContainer();
  const [state, setState] = useState<RoutingConsentState | undefined>(undefined);
  useEffect(() => {
    let live = true;
    consentListeners.add(setState);
    c.routePlanning.routingConsent.execute().then(
      (s) => live && setState(s),
      () => live && setState('unasked')
    );
    return () => {
      live = false;
      consentListeners.delete(setState);
    };
  }, [c]);
  const set = useCallback(
    async (granted: boolean) => {
      await c.routePlanning.setRoutingConsent.execute(granted);
      const next: RoutingConsentState = granted ? 'granted' : 'declined';
      consentListeners.forEach((l) => l(next));
      if (granted) {
        // Offline or rate limited: the legs stay straight and the planner offers to try again.
        c.routePlanning.snap.execute().catch(() => undefined);
      }
    },
    [c]
  );
  return [state, set];
}
