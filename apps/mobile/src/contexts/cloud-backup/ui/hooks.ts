import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { AfterCredentialsResult } from '../application/after-credentials';
import type { RestoreOffer, RestoreProgress, RestoreResult } from '../application/restore';
import type { BackupCommandResult, BackupStatus } from '../contract';
import { RUNNING_REFRESH_MS } from './hooks.constants';

/** Cloud backup status, switches, token and "Back up now", for the Info screen card. `status` is null while loading. */
export function useCloudBackup() {
  const c = useContainer();
  const { dataVersion } = useApp();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  /** Counts finished refreshes, failed ones too: the running poll re-arms on it, so it never stalls. */
  const [answered, setAnswered] = useState(0);
  const focused = useIsFocused();

  const refresh = useCallback(
    () =>
      c.cloudBackup.status
        .execute()
        .then(setStatus)
        .catch(() => undefined)
        .finally(() => setAnswered((n) => n + 1)),
    [c]
  );
  // Again on coming back into view (e.g. from turning backup on in another screen) and on data changes.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a data change asks again (while in view)
    }, [refresh, dataVersion])
  );
  /**
   * A pass started elsewhere (another screen, the app's own runs): follow it until it ends, only
   * while this screen is in view (coming back refreshes anyway). Each answer, or failure, arms the next.
   */
  const running = status?.running ?? false;
  useEffect(() => {
    if (!running || !focused) {
      return;
    }
    const timer = setTimeout(() => void refresh(), RUNNING_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [running, focused, answered, refresh]);

  /** Runs a backup pass and refreshes the status while and after it runs; resolves with its result. */
  const backUpNow = useCallback(
    async (options: { now?: boolean } = { now: true }) => {
      const running = c.backUp(options);
      void refresh(); // shows "Backing up…"
      const result = await running;
      await refresh();
      return result;
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

  /** The status read now (not the last one shown), for a decision about to be taken. */
  const current = useCallback(() => c.cloudBackup.status.execute(), [c]);

  /** The profile was just linked by a code: Cloud Backup decides; a run starts when backup is on. */
  const afterCredentials = useCallback(async (): Promise<AfterCredentialsResult> => {
    const r = await c.cloudBackup.afterCredentials.execute();
    if (r.kind === 'turned-on' || r.kind === 'carried-on') {
      void backUpNow();
    } else {
      await refresh();
    }
    return r;
  }, [c, backUpNow, refresh]);

  return {
    status,
    refresh,
    current,
    setEnabled,
    setHealthIncluded,
    saveToken,
    removeToken,
    saveServerUrl,
    backUpNow,
    afterCredentials,
  };
}

/**
 * "Restore from your backup": the offer (asked once per container: it reads the server's manifest;
 * `ask: false` skips it, for the always-available action on the Cloud backup card), the running
 * restore's progress, its result, "Not now" and "Turn on backup" afterwards.
 */
export function useRestore({ ask = true }: { ask?: boolean } = {}) {
  const c = useContainer();
  const [offer, setOffer] = useState<RestoreOffer | null>(null);
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!ask) {
      return;
    }
    let live = true;
    c.cloudBackup.restoreOffer
      .execute()
      .then((o) => live && setOffer(o))
      .catch(() => live && setOffer({ kind: 'none' }));
    return () => {
      live = false;
    };
  }, [c, ask]);

  const start = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await c.cloudBackup.restore.execute(setProgress);
      await c.dispatcher.dispatchPending(); // claims turf for what arrived
      setResult(r);
      if (r.kind === 'done') {
        setOffer({ kind: 'none' });
        void c.syncHealth(); // Apple Health import waited for the restore
      }
      // Backup runs waited while the restore ran (finished or paused): send what is queued now. It
      // compares with the server first, so nothing is sent for what just arrived; off: skipped.
      void c.backUp();
      return r;
    } catch {
      const failed: RestoreResult = { kind: 'paused', reason: 'server', done: 0, total: 0 };
      setResult(failed);
      return failed;
    } finally {
      setRunning(false);
    }
  }, [c]);

  /** After a restore that left backup off (the server's consents couldn't be read): turn it on. */
  const turnOnBackup = useCallback(async (): Promise<BackupCommandResult> => {
    const r = await c.cloudBackup.enable.execute();
    if (r.kind === 'ok') {
      setResult((x) => (x?.kind === 'done' ? { ...x, backupOn: true } : x));
      void c.backUp();
    }
    return r;
  }, [c]);

  const dismiss = useCallback(() => {
    if (offer?.kind === 'available') {
      void c.cloudBackup.dismissRestore.execute().catch(() => undefined); // "Not now": not offered again
    }
    setOffer({ kind: 'none' });
    setResult(null);
  }, [c, offer]);

  return { offer, progress, result, running, start, dismiss, turnOnBackup };
}
