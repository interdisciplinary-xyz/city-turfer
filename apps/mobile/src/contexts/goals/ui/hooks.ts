import { useCallback, useEffect, useMemo, useState } from 'react';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { DailyGoalView } from '../contract';
import { addLiveMovingTime } from '../index';
import { useLocalDay } from './use-local-day';

/** Screens showing the goal, told directly after a change (the outbox may hold the change event). */
const goalListeners = new Set<() => void>();

/**
 * Today's Daily goal and the last 7 days; null while loading. Re-reads when stored data changes
 * (an Activity saved, deleted or imported, the goal changed) and when the local day rolls over.
 * `live`: the recording in progress (the screen passes Recording's live snapshot); its moving
 * seconds are added on screen to the day it started, never stored. Recording clears its snapshot
 * before the finished Activity is saved, so a finished recording is counted once, from the stored
 * Activity.
 */
export function useDailyGoal(live: { movingS: number; startedAt: number } | null = null): DailyGoalView | null {
  const c = useContainer();
  const { dataVersion } = useApp();
  const day = useLocalDay();
  const [stored, setStored] = useState<DailyGoalView | null>(null);
  const [changed, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    goalListeners.add(l);
    return () => {
      goalListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    let current = true;
    c.goals.view
      .execute()
      .then((v) => current && setStored(v))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [c, dataVersion, day, changed]);
  const liveMovingS = live?.movingS ?? 0;
  const liveStartedAt = live?.startedAt ?? 0;
  return useMemo(
    () => (stored && liveMovingS > 0 ? addLiveMovingTime(stored, liveMovingS, liveStartedAt) : stored),
    [stored, liveMovingS, liveStartedAt]
  );
}

/** Set the goal from today (null: off) and hide the offer; screens showing the goal re-read at once. */
export function useGoalActions() {
  const c = useContainer();
  const set = useCallback(
    async (minutes: number | null) => {
      await c.goals.set.execute(minutes);
      goalListeners.forEach((l) => l());
    },
    [c]
  );
  const hideOffer = useCallback(async () => {
    await c.goals.hideOffer.execute();
    goalListeners.forEach((l) => l());
  }, [c]);
  return { set, hideOffer };
}
