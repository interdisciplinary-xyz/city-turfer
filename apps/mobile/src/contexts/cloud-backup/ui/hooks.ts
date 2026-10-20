import { useCallback, useEffect, useState } from 'react';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { BackupCommandResult, BackupStatus } from '../contract';

/** Cloud backup status, switches, token and "Back up now", for the Info screen card. `status` is null while loading. */
export function useCloudBackup() {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [status, setStatus] = useState<BackupStatus | null>(null);

  const refresh = useCallback(
    () =>
      c.cloudBackup.status
        .execute()
        .then(setStatus)
        .catch(() => undefined),
    [c]
  );
  useEffect(() => void refresh(), [refresh, dataVersion]);

  /** Runs a backup pass and refreshes the status while and after it runs. */
  const backUpNow = useCallback(
    async (options: { now?: boolean } = { now: true }) => {
      const running = c.backUp(options);
      void refresh(); // shows "Backing up…"
      await running;
      await refresh();
    },
    [c, refresh]
  );

  const after = useCallback(
    async (result: BackupCommandResult) => {
      await refresh();
      return result;
    },
    [refresh]
  );

  const setEnabled = useCallback(
    async (on: boolean): Promise<BackupCommandResult> => {
      const r = on ? await c.cloudBackup.enable.execute() : await c.cloudBackup.disable.execute();
      if (on && r.kind === 'ok') {
        void backUpNow(); // the first upload starts right away
      }
      return after(r);
    },
    [c, after, backUpNow]
  );

  const setHealthIncluded = useCallback(
    async (on: boolean): Promise<BackupCommandResult> => {
      const r = await c.cloudBackup.includeHealth.execute(on);
      if (on && r.kind === 'ok') {
        void backUpNow();
      }
      return after(r);
    },
    [c, after, backUpNow]
  );

  const saveToken = useCallback(
    async (token: string) => {
      await c.cloudBackup.saveToken.execute(token);
      await refresh();
    },
    [c, refresh]
  );

  const removeToken = useCallback(async () => {
    await c.cloudBackup.removeToken.execute();
    await refresh();
  }, [c, refresh]);

  const saveServerUrl = useCallback(
    async (url: string | null) => {
      await c.cloudBackup.useServer.execute(url);
      await refresh();
    },
    [c, refresh]
  );

  return { status, setEnabled, setHealthIncluded, saveToken, removeToken, saveServerUrl, backUpNow };
}
