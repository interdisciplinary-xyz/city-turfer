import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  backgroundActivitySession,
  type Container,
  deleteProfileData,
  finishProfileDeletion,
  getContainer,
  identity,
  resetContainer,
  retryProfileDeletions,
} from '@/composition-root';
import type { User } from '@/contexts/identity';
import { prepareDemoAccount } from '@/dev/gdansk-demo';

import type { AppContextValue, AuthState } from './app-context.constants';

const Ctx = createContext<AppContextValue | null>(null);

const sameUser = (a: User, b: User) =>
  a.email === b.email && a.name === b.name && a.displayName === b.displayName && a.accountId === b.accountId;

export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [dataVersion, setDataVersion] = useState(0);

  /** Stable (screens call it from effects); a no-op when nothing shown changed. */
  const updateUser = useCallback((user: User) => {
    setAuth((a) => (a.status === 'signed-in' && a.user.id === user.id && !sameUser(a.user, user) ? { ...a, user } : a));
  }, []);

  /** `fresh`: a sign-in (not the session restored at launch) — finish a deletion pending for this profile first. */
  const enter = useCallback(
    async (user: User, fresh = true) => {
      if (fresh) {
        await finishProfileDeletion(user.id);
      }
      const container = await getContainer();
      if (!container) {
        return setAuth({ status: 'signed-out' });
      }
      await container.recording.recover.execute().catch(() => undefined);
      setAuth({ status: 'signed-in', user, container });
      // Demo account only: fills in Gdańsk demo data on first use; screens refresh as it lands.
      void prepareDemoAccount(user, container).catch(() => undefined);
      if (user.accountId) {
        // Best effort: the account's name (and an email changed on the web) from the server.
        void identity.accountSettings
          .execute()
          .then((r) => (r.kind === 'account' ? identity.currentUser.execute() : null))
          .then((u) => u && updateUser(u))
          .catch(() => undefined);
      }
    },
    [updateUser]
  );

  useEffect(() => {
    // Data the Turfer deleted from this phone whose deletion failed last time goes first.
    retryProfileDeletions()
      .then(() => identity.currentUser.execute())
      .then((u) => (u ? enter(u, false) : setAuth({ status: 'signed-out' })))
      .catch(() => setAuth({ status: 'signed-out' }));
  }, [enter]);

  const container = auth.status === 'signed-in' ? auth.container : null;
  useEffect(() => container?.dispatcher.onChange(() => setDataVersion((v) => v + 1)), [container]);
  useEffect(() => {
    if (!container) {
      return;
    }
    const sub = AppState.addEventListener('change', (s) =>
      container.diagnostics.log('app-state', {
        appState: s,
        bgSession: backgroundActivitySession.isActive(),
        liveStreaming: backgroundActivitySession.isStreaming(),
        lowPowerMode: backgroundActivitySession.isLowPowerMode(),
      })
    );
    return () => sub.remove();
  }, [container]);

  const value = useMemo<AppContextValue>(
    () => ({
      auth,
      dataVersion,
      async signIn(email, password) {
        const r = await identity.signIn.execute(email, password);
        if (r.kind === 'linked-to-account') {
          return 'linked-to-account';
        }
        if (r.kind !== 'signed-in') {
          return 'invalid';
        }
        await enter(r.user);
        return 'ok';
      },
      startSignIn: (email) => identity.startSignIn.execute(email),
      async signInWithPassword(email, password) {
        const r = await identity.signInWithPassword.execute(email, password);
        if (r.kind !== 'signed-in') {
          return r;
        }
        await enter(r.user);
        return { kind: 'ok' };
      },
      updateUser,
      requestDataExport: () => identity.requestDataExport.execute(),
      async verifyCode(email, code) {
        const r = await identity.verifyCode.execute(email, code);
        if (r.kind !== 'signed-in') {
          return r;
        }
        await enter(r.user);
        return { kind: 'ok' };
      },
      async chooseHistory(useThisPhonesHistory) {
        const r = await identity.chooseHistory.execute(useThisPhonesHistory);
        if (r.kind !== 'signed-in') {
          return 'no-pending';
        }
        await enter(r.user);
        return 'ok';
      },
      async signOut() {
        const r = await identity.signOut.execute();
        if (r.kind === 'recording-in-progress') {
          return 'recording-in-progress';
        }
        await resetContainer();
        setAuth({ status: 'signed-out' });
        return 'ok';
      },
      async deleteAccount(keepData) {
        const r = await identity.deleteAccount.execute(keepData);
        if (r.kind !== 'deleted') {
          return r;
        }
        // The account is gone: always signed out here, whichever profile held its data.
        await resetContainer();
        let localDeleted = true;
        if (!keepData && r.profileId) {
          // Failed: retried on the next launch, and before that profile is opened again.
          localDeleted = await deleteProfileData(r.profileId).then(
            () => true,
            () => false
          );
        }
        setAuth({ status: 'signed-out' });
        return localDeleted ? { kind: 'ok' } : { kind: 'ok-local-pending' };
      },
    }),
    [auth, dataVersion, enter, updateUser]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useApp outside AppProvider');
  }
  return v;
}

/** The signed-in user's container (screens behind the auth guard only). */
export function useContainer(): Container {
  const { auth } = useApp();
  if (auth.status !== 'signed-in') {
    throw new Error('No signed-in user');
  }
  return auth.container;
}
