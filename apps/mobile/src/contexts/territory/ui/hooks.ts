import { useCallback, useEffect, useMemo, useState } from 'react';

import { ACTIVITY_TYPES } from '@/constants/activity';
import { type ActivityType, type BoundingBox } from '@/shared-kernel';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { CityView, ClaimView, TurfCellView, TurfSummaryView } from '../contract';

/** Screens showing the Home City, told to re-read it right after a choice (not via the outbox, which
 * can be backing off behind an earlier event). */
const homeCityListeners = new Set<() => void>();

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

export function useClaim(activityId: string): ClaimView | null {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [v, set] = useState<ClaimView | null>(null);
  useEffect(() => {
    c.territory.claimOf.execute(activityId).then(set);
  }, [c, activityId, dataVersion]);
  return v;
}
