import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { liveSessionStore } from '@/composition-root';
import type { ActivityType, TrackPoint } from '@/shared-kernel';
import { useContainer } from '@/ui-kit/app-context';

import type { LiveSnapshot } from '../domain/recording-session';

const subscribe = (l: () => void) => liveSessionStore.subscribe(l);
const getSnapshot = () => liveSessionStore.get();

/** Live recording state for the Record screen. */
export function useRecording() {
  const c = useContainer();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as LiveSnapshot | null;
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [now, setNow] = useState(Date.now());
  const lastFetch = useRef(0);

  // Load current state once (e.g. reopened app mid-recording).
  useEffect(() => {
    c.recording.liveSnapshot.execute().then((s) => s && liveSessionStore.publish(s));
  }, [c]);

  // 1 Hz clock for the running timer.
  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [snapshot]);

  // Refresh the live track when new points arrive (throttled).
  const pointCount = snapshot?.pointCount ?? 0;
  useEffect(() => {
    if (!snapshot) {
      return setTrack([]);
    }
    const wait = Math.max(0, 2000 - (Date.now() - lastFetch.current));
    const id = setTimeout(() => {
      lastFetch.current = Date.now();
      c.recording.liveTrack.execute().then(setTrack);
    }, wait);
    return () => clearTimeout(id);
  }, [c, pointCount, snapshot?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer keeps ticking between location batches while recording.
  const activeS = snapshot
    ? snapshot.activeS +
      (snapshot.status === 'recording' ? Math.max(0, Math.floor((now - snapshot.computedAt) / 1000)) : 0)
    : 0;

  return {
    snapshot,
    track,
    activeS,
    prepare: useCallback(() => c.recording.prepare.execute(), [c]),
    start: useCallback((type: ActivityType) => c.recording.start.execute(type), [c]),
    pause: useCallback(() => c.recording.pause.execute(), [c]),
    resume: useCallback(() => c.recording.resume.execute(), [c]),
    finish: useCallback(() => c.recording.finish.execute(), [c]),
    discard: useCallback(() => c.recording.discard.execute(), [c]),
  };
}
