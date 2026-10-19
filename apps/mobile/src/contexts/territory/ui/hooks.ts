import { useCallback, useEffect, useMemo, useState } from 'react';

import { ACTIVITY_TYPES } from '@/constants/activity';
import { type ActivityType, type BoundingBox } from '@/shared-kernel';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { CityView, ClaimView, TurfCellView, TurfSummaryView } from '../contract';

/**
 * The Home City: `undefined` while loading, `null` if none is chosen. Refreshes when the choice
 * changes anywhere (the HomeCityChosen event bumps `dataVersion`).
 */
export function useHomeCity(): CityView | null | undefined {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [city, set] = useState<CityView | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    c.territory.homeCity.execute().then((v) => live && set(v));
    return () => {
      live = false;
    };
  }, [c, dataVersion]);
  return city;
}

/** Chooses (or, with null, clears) the Home City. */
export function useChooseHomeCity(): (cityId: string | null) => Promise<void> {
  const c = useContainer();
  return useCallback((cityId) => c.territory.chooseHomeCity.execute(cityId), [c]);
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
