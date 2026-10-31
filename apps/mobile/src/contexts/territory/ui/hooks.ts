import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ACTIVITY_TYPES } from '@/constants/activity';
import { type ActivityType, type BoundingBox } from '@/shared-kernel';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { CityView, ClaimView, DistrictsView, TurfCellView, TurfSummaryView } from '../contract';
import { hasDistricts } from '../infrastructure/district-cities';
import { turfOverlayPreference } from '../infrastructure/turf-overlay-preference';
import { type DistrictsState, readDistricts } from './read-districts';
import { overlayArea, overlayStillCovers } from './turf-overlay-area';
import type { OverlayView } from './turf-overlay-area.constants';

/** Screens showing the Home City, told to re-read it right after a choice (not via the outbox, which
 * can be backing off behind an earlier event). */
const homeCityListeners = new Set<() => void>();

/** One empty list, so a hidden overlay hands the same reference to memoised layers. */
const NO_CELLS: TurfCellView[] = [];

/**
 * The Home City: `undefined` while loading, `null` if none is chosen (or it can't be read: maps
 * then fall back to their usual view rather than staying blank). Refreshes after a choice and on
 * `dataVersion`.
 */
export function useHomeCity(): CityView | null | undefined {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [city, set] = useState<CityView | null | undefined>(undefined);
  const [chosen, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    homeCityListeners.add(l);
    return () => {
      homeCityListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    let live = true;
    c.territory.homeCity.execute().then(
      (v) => live && set(v),
      () => live && set((cur) => cur ?? null)
    );
    return () => {
      live = false;
    };
  }, [c, dataVersion, chosen]);
  return city;
}

/** Chooses (or, with null, clears) the Home City; every screen showing it re-reads it. */
export function useChooseHomeCity(): (cityId: string | null) => Promise<void> {
  const c = useContainer();
  return useCallback(
    async (cityId) => {
      await c.territory.chooseHomeCity.execute(cityId);
      homeCityListeners.forEach((l) => l());
    },
    [c]
  );
}

/** Catalogue cities matching the query (synchronous: the catalogue ships with the app). */
export function useCitySearch(query: string): CityView[] {
  const c = useContainer();
  return useMemo(() => c.territory.searchCities.execute(query), [c, query]);
}

export function useTurfSummary(): TurfSummaryView | null {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [s, set] = useState<TurfSummaryView | null>(null);
  useEffect(() => {
    c.territory.summary.execute().then(set);
  }, [c, dataVersion]);
  return s;
}

export function useTurfViewport(
  view: { bbox: BoundingBox; zoom: number } | null,
  types: readonly ActivityType[] = ACTIVITY_TYPES
): TurfCellView[] {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [cells, set] = useState<TurfCellView[]>([]);
  const key = view ? `${view.bbox.map((n) => n.toFixed(4)).join(',')}@${view.zoom.toFixed(1)}` : '';
  useEffect(() => {
    if (!view) {
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      c.territory.viewport.execute(view.bbox, view.zoom, types).then((r) => live && set(r));
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [c, key, dataVersion, types.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return cells;
}

/**
 * The Turfer's turf as an overlay for another map (the Record map), with a remembered on/off
 * switch. `shown` is `undefined` while the choice loads. Feed the map's view to `onViewChange`
 * (stable; cheap to call on every camera move): turf is loaded for an area around the view
 * (`overlayArea`) and only re-read once the view leaves it, so a map following the Turfer neither
 * queries nor re-renders on every location update.
 */
export function useTurfOverlay(): {
  shown: boolean | undefined;
  setShown: (shown: boolean) => void;
  cells: TurfCellView[];
  onViewChange: (view: OverlayView) => void;
} {
  const c = useContainer();
  const [shown, setShownState] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setShownState(undefined); // another Turfer: don't show the previous one's choice
    void turfOverlayPreference.isShown(c.userId).then((v) => live && setShownState(v));
    return () => {
      live = false;
    };
  }, [c]);
  const setShown = useCallback(
    (v: boolean) => {
      setShownState(v);
      void turfOverlayPreference.setShown(c.userId, v);
    },
    [c]
  );

  const [area, setArea] = useState<OverlayView | null>(null);
  const view = useRef<OverlayView | null>(null);
  const showing = useRef(false);
  showing.current = shown === true;
  const follow = useCallback(() => {
    const v = view.current;
    if (showing.current && v) {
      setArea((a) => (overlayStillCovers(a, v) ? a : overlayArea(v)));
    }
  }, []);
  const onViewChange = useCallback(
    (v: OverlayView) => {
      view.current = v;
      follow();
    },
    [follow]
  );
  useEffect(follow, [shown, follow]);
  const cells = useTurfViewport(shown ? area : null);
  return { shown, setShown, cells: shown ? cells : NO_CELLS, onViewChange };
}

export function useClaim(activityId: string): ClaimView | null {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [v, set] = useState<ClaimView | null>(null);
  useEffect(() => {
    c.territory.claimOf.execute(activityId).then(set);
  }, [c, activityId, dataVersion]);
  return v;
}

/** Whether the city has district boundaries in the app (the Turf tab's Districts chip). */
export function useHasDistricts(cityId: string | null | undefined): boolean {
  return useMemo(() => (cityId ? hasDistricts(cityId) : false), [cityId]);
}

/**
 * The Home City's districts with the turf held in each (Districts screen): `undefined` while
 * loading, `null` if they couldn't be read (an earlier answer is kept). Re-read after a new or
 * deleted activity (`dataVersion`) and after a Home City choice.
 */
export function useDistricts(): DistrictsView | null | undefined {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [v, set] = useState<DistrictsState>(undefined);
  const [chosen, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    homeCityListeners.add(l);
    return () => {
      homeCityListeners.delete(l);
    };
  }, []);
  useEffect(
    () => readDistricts((isCurrent) => c.territory.districts.execute({ isCurrent }), set),
    [c, dataVersion, chosen]
  );
  return v;
}
