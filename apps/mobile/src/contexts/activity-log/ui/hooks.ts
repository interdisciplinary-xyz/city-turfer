import { useCallback, useEffect, useState } from 'react';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { ActivityDetail, ActivityListItem } from '../contract';

export function useActivities(limit = 500): ActivityListItem[] | null {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [items, set] = useState<ActivityListItem[] | null>(null);
  useEffect(() => {
    c.activityLog.list.execute(limit).then(set);
  }, [c, dataVersion, limit]);
  return items;
}

export function useActivity(id: string) {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [detail, set] = useState<ActivityDetail | null | undefined>(undefined);
  useEffect(() => {
    c.activityLog.detail.execute(id).then(set);
  }, [c, id, dataVersion]);
  return {
    detail,
    remove: () => c.activityLog.remove.execute(id),
    rename: (name: string) => c.activityLog.rename.execute(id, name),
  };
}

/** "Estimate GPS gaps along streets": null while loading. Turning it on estimates pending gaps right away. */
export function useGapEstimationSetting(): [boolean | null, (enabled: boolean) => Promise<void>] {
  const c = useContainer();
  const [enabled, set] = useState<boolean | null>(null);
  useEffect(() => {
    c.activityLog.gapEstimationEnabled
      .execute()
      .then(set)
      .catch(() => set(false));
  }, [c]);
  const update = useCallback(
    async (on: boolean) => {
      await c.activityLog.setGapEstimationEnabled.execute(on);
      set(on);
      if (on) void c.estimateGaps();
    },
    [c]
  );
  return [enabled, update];
}
