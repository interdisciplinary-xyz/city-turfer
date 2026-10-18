import { useEffect, useSyncExternalStore } from 'react';

import { liveSessionStore } from '@/composition-root';
import { useContainer } from '@/ui-kit/app-context';

import type { LiveSnapshot } from '../domain/recording-session';

const subscribe = (l: () => void) => liveSessionStore.subscribe(l);
const getSnapshot = () => liveSessionStore.get();

/** The active Recording Session, if any — without the Record screen's timer and track polling. */
export function useLiveSession(): LiveSnapshot | null {
  const c = useContainer();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as LiveSnapshot | null;
  useEffect(() => {
    c.recording.liveSnapshot.execute().then((s) => s && liveSessionStore.publish(s));
  }, [c]);
  return snapshot;
}
