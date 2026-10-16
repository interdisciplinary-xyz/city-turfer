import { useEffect, useState } from 'react';

import { ACTIVITY_TYPES, type ActivityType, type BoundingBox } from '@/shared-kernel';
import { useApp, useContainer } from '@/ui-kit/AppContext';

import type { ClaimView, TurfCellView, TurfSummaryView } from '../contract';

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
    if (!view) return;
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
