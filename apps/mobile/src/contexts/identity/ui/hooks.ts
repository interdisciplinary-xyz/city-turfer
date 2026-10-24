import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { identity } from '@/composition-root';
import type { BackupLinkTarget, User } from '@/contexts/identity';
import { useApp } from '@/ui-kit/app-context';

import { failureMessage } from './account-messages';
import type { AccountRefusal, AccountSettingsState, ErrorMessage } from './account-settings.constants';
import { latestRequest, refreshAnswered, refreshStarted } from './account-settings-state';
import { waitUntilAfter, watchCooldown } from './cooldown';

/**
 * Me › Account: the account's name, email and password state, asked from the server each time the
 * screen comes into view (a local profile answers from the phone). Offline: `offline`. While it
 * asks again the last answer is marked stale (`refreshing` / `retrying`), and only the newest
 * request's answer is used.
 */
export function useAccountSettings() {
  const { updateUser } = useApp();
  const [state, setState] = useState<AccountSettingsState>({ status: 'loading' });
  const [requests] = useState(latestRequest);

  const refresh = useCallback(async () => {
    const id = requests.begin();
    setState(refreshStarted);
    const r = await identity.accountSettings.execute().catch(() => ({ kind: 'unavailable' as const }));
    if (!requests.isLatest(id)) {
      return; // a newer request is on its way: its answer wins
    }
    const next = refreshAnswered(r);
    setState(next);
    if (next.status === 'ready') {
      // The name (or an email changed elsewhere) reaches the header, the menu and the dashboard.
      const user = await identity.currentUser.execute().catch(() => null);
      if (user && requests.isLatest(id)) {
        updateUser(user);
      }
    }
  }, [requests, updateUser]);

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
 * One request at a time for a flow step (a double tap sends one code), with its error message
 * (a key in `errors`: the component words it, so it follows a language change). `work` resolves
 * with the message to show, or nothing when it went well. `refused` picks a failure's message; when it is a rate limit with Retry-After, `waiting` stays true until that time has
 * passed, so the send buttons can stay disabled (the server's bucket is shared per IP: extra taps
 * would only push the wait further).
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  /** Epoch ms until which the server asked us to wait; 0: no wait. */
  const [waitUntil, setWaitUntil] = useState(0);
  // A ref, not the state: a second keyboard submit in the same frame must see the first one.
  const inFlight = useRef(false);

  useEffect(() => (waitUntil ? watchCooldown(waitUntil, () => setWaitUntil(0)) : undefined), [waitUntil]);

  const refused = useCallback((f: AccountRefusal): ErrorMessage => {
    const until = waitUntilAfter(f, Date.now());
    if (until) {
      setWaitUntil(until);
    }
    return failureMessage(f);
  }, []);

  const run = useCallback(async (work: () => Promise<ErrorMessage | null | void>) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setError((await work()) ?? null);
    } catch {
      setError(failureMessage({ kind: 'unavailable' }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run, refused, waiting: waitUntil !== 0, waitUntil };
}

/** Whole seconds left until `until` (epoch ms), ticking once a second; 0 once it has passed or with no wait. */
export function useSecondsLeft(until: number): number {
  const left = () => Math.max(0, Math.ceil((until - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    setSeconds(left());
    if (!until) {
      return;
    }
    const timer = setInterval(() => {
      const s = left();
      setSeconds(s);
      if (s === 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `left` only reads `until`
  }, [until]);
  return seconds;
}

/**
 * Info › Cloud backup on a local profile (mock admin, demo): the address its backup code goes to,
 * read again each time the screen comes into view. `undefined` while loading; null: not a local
 * profile that may be linked (a real account, or one whose data belongs to another address).
 */
export function useBackupLinkTarget(): BackupLinkTarget | null | undefined {
  const { auth } = useApp();
  const profileId = auth.status === 'signed-in' ? auth.user.id : null;
  const [target, setTarget] = useState<BackupLinkTarget | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      if (!profileId) {
        setTarget(null);
        return;
      }
      identity.backupLinkTarget
        .execute(profileId)
        .catch(() => null)
        .then((t) => live && setTarget(t));
      return () => {
        live = false;
      };
    }, [profileId])
  );
  return target;
}

/**
 * The backup link's use cases for the signed-in local profile: "Email me a code" and the code. A
 * linked profile's user (now with its account) is shown everywhere at once.
 */
export function useBackupLink() {
  const { auth, updateUser } = useApp();
  const profileId = auth.status === 'signed-in' ? auth.user.id : '';
  return {
    requestCode: () => identity.requestBackupLinkCode.execute(profileId),
    link: async (code: string) => {
      const r = await identity.linkSignedInProfile.execute(profileId, code);
      if (r.kind === 'linked') {
        updateUser(r.user);
      }
      return r;
    },
  };
}
