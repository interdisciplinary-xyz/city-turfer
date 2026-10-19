import { useCallback, useEffect, useState } from 'react';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { HealthSyncStatus, ImportReport } from '../contract';

/** Apple Health connection, switches and import, for the Settings card. `status` is null while loading. */
export function useHealthSync() {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [status, setStatus] = useState<HealthSyncStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const refresh = useCallback(
    () =>
      c.healthSync.status
        .execute()
        .then(setStatus)
        .catch(() => undefined),
    [c]
  );
  useEffect(() => void refresh(), [refresh, dataVersion]);

  const importNow = useCallback(async (): Promise<ImportReport | null> => {
    setProgress(0);
    try {
      // Import now scans all of Apple Health: also catches workouts whose route arrived late.
      const report = await c.healthSync.importWorkouts.execute({ full: true, onProgress: setProgress });
      await c.dispatcher.dispatchPending(); // claim the new turf now, not on the next launch
      return report;
    } finally {
      setProgress(null);
      await refresh();
    }
  }, [c, refresh]);

  const connect = useCallback(async () => {
    await c.healthSync.connect.execute();
    await refresh();
    return importNow();
  }, [c, refresh, importNow]);

  const disconnect = useCallback(async () => {
    await c.healthSync.disconnect.execute();
    await refresh();
  }, [c, refresh]);

  const setDirections = useCallback(
    async (patch: { importEnabled?: boolean; exportEnabled?: boolean }) => {
      await c.healthSync.setDirections.execute(patch);
      await refresh();
    },
    [c, refresh]
  );

  return { status, progress, connect, disconnect, importNow, setDirections };
}
