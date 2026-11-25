import { useCallback, useEffect, useState } from 'react';

import { useContainer } from './app-context';
import { useAsyncAction } from './use-async-action';

/**
 * Info › "Send crash reports" (on unless the Turfer turned it off): the value (null while it is
 * read) and a setter that applies at once. A failed save keeps the old value and says so.
 */
export function useCrashReports() {
  const { crashReports } = useContainer();
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const { run, isLoading } = useAsyncAction<void>({
    area: 'settings',
    code: 'crash-reports',
    errorKey: 'info.settingNotSaved',
  });

  useEffect(() => {
    let live = true;
    void crashReports.isEnabled().then((on) => live && setEnabledState(on));
    return () => {
      live = false;
    };
  }, [crashReports]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      setEnabledState(on);
      const r = await run(() => crashReports.setEnabled(on));
      if (r.status === 'failed') {
        setEnabledState(await crashReports.isEnabled());
      }
    },
    [crashReports, run]
  );

  return { enabled, setEnabled, saving: isLoading };
}
