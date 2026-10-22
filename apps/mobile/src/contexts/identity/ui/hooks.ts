import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { identity } from '@/composition-root';
import type { AccountFailure, NotSignedIn, User } from '@/contexts/identity';
import { useApp } from '@/ui-kit/app-context';

import { type AccountSettingsState, COOLDOWN_CHECK_MS, failureText } from './account-settings.constants';

/**
 * Me › Account: the account's name, email and password state, asked from the server each time the
 * screen comes into view (a local profile answers from the phone). Offline: `offline`.
 */
export function useAccountSettings() {
  const { updateUser } = useApp();
  const [state, setState] = useState<AccountSettingsState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    const r = await identity.accountSettings.execute().catch(() => ({ kind: 'unavailable' as const }));
    if (r.kind === 'account' || r.kind === 'local') {
      setState({ status: 'ready', settings: r });
      // The name (or an email changed elsewhere) reaches the header, the menu and the dashboard.
      const user = await identity.currentUser.execute().catch(() => null);
      if (user) {
        updateUser(user);
      }
    } else if (r.kind === 'offline') {
      setState({ status: 'offline' });
    } else {
      setState({ status: 'failed', reason: r.kind });
    }
  }, [updateUser]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );
  return { state, refresh };
}

/**
 * The account-settings use cases for the flows. A change that returns the signed-in user (name,
 * email) is shown everywhere at once.
 */
export function useAccountActions() {
  const { updateUser } = useApp();
  const show = useCallback(
    <R extends { kind: string }>(r: R): R => {
      if ('user' in r && r.user) {
        updateUser(r.user as User);
      }
      return r;
    },
    [updateUser]
  );
  return {
    updateName: (raw: string) => identity.updateName.execute(raw).then(show),
    requestStepUpCode: () => identity.requestStepUpCode.execute(),
    requestEmailChange: (newEmail: string, stepUpCode: string) =>
      identity.requestEmailChange.execute(newEmail, stepUpCode),
    confirmEmailChange: (newEmail: string, code: string) =>
      identity.confirmEmailChange.execute(newEmail, code).then(show),
    setPassword: (password: string, stepUpCode: string) => identity.setPassword.execute(password, stepUpCode),
    removePassword: (stepUpCode: string) => identity.removePassword.execute(stepUpCode),
  };
}

/**
 * One request at a time for a flow step (a double tap sends one code), with its error message.
 * `work` resolves with the message to show, or nothing when it went well. `refused` words a
 * failure; when it is a rate limit with Retry-After, `waiting` stays true until that time has
 * passed, so the send buttons can stay disabled (the server's bucket is shared per IP: extra taps
 * would only push the wait further).
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Epoch ms until which the server asked us to wait; 0: no wait. */
  const [waitUntil, setWaitUntil] = useState(0);
  const [check, setCheck] = useState(0);
  // A ref, not the state: a second keyboard submit in the same frame must see the first one.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!waitUntil) {
      return;
    }
    const left = waitUntil - Date.now();
    if (left <= 0) {
      setWaitUntil(0);
      return;
    }
    // Checked again at least every minute: timers don't run while the app is in the background.
    const t = setTimeout(() => setCheck((n) => n + 1), Math.min(left, COOLDOWN_CHECK_MS));
    return () => clearTimeout(t);
  }, [waitUntil, check]);

  const refused = useCallback((f: AccountFailure | NotSignedIn | { kind: 'unavailable' }): string => {
    if (f.kind === 'rate-limited' && f.retryAfterS && f.retryAfterS > 0) {
      setWaitUntil(Date.now() + f.retryAfterS * 1000);
    }
    return failureText(f);
  }, []);

  const run = useCallback(async (work: () => Promise<string | null | void>) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setError((await work()) ?? null);
    } catch {
      setError(failureText({ kind: 'unavailable' }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run, refused, waiting: waitUntil !== 0 };
}
