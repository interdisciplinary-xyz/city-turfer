import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { backgroundActivitySession, type Container, getContainer, identity, resetContainer } from '@/composition-root';
import type { User } from '@/contexts/identity';

type AuthState =
  { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User; container: Container };

interface AppContextValue {
  auth: AuthState;
  /** Increments whenever persisted data changed (outbox processed). */
  dataVersion: number;
  signIn(email: string, password: string): Promise<'ok' | 'invalid'>;
  signOut(): Promise<'ok' | 'recording-in-progress'>;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [dataVersion, setDataVersion] = useState(0);

  const enter = useCallback(async (user: User) => {
    const container = await getContainer();
    if (!container) return setAuth({ status: 'signed-out' });
    await container.recording.recover.execute().catch(() => undefined);
    setAuth({ status: 'signed-in', user, container });
  }, []);

  useEffect(() => {
    identity.currentUser
      .execute()
      .then((u) => (u ? enter(u) : setAuth({ status: 'signed-out' })))
      .catch(() => setAuth({ status: 'signed-out' }));
  }, [enter]);

  const container = auth.status === 'signed-in' ? auth.container : null;
  useEffect(() => container?.dispatcher.onChange(() => setDataVersion((v) => v + 1)), [container]);
  useEffect(() => {
    if (!container) return;
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
        if (r.kind !== 'signed-in') return 'invalid';
        await enter(r.user);
        return 'ok';
      },
      async signOut() {
        const r = await identity.signOut.execute();
        if (r.kind === 'recording-in-progress') return 'recording-in-progress';
        await resetContainer();
        setAuth({ status: 'signed-out' });
        return 'ok';
      },
    }),
    [auth, dataVersion, enter]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** The signed-in user's container (screens behind the auth guard only). */
export function useContainer(): Container {
  const { auth } = useApp();
  if (auth.status !== 'signed-in') throw new Error('No signed-in user');
  return auth.container;
}
