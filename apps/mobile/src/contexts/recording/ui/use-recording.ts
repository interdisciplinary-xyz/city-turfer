import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { liveSessionStore } from '@/composition-root';
import type { ActivityType, TrackPoint } from '@/shared-kernel';
import { useContainer } from '@/ui-kit/app-context';

import { advanceLiveClock, type LiveClock } from '../domain/live-moving-time';
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

  // 1 Hz clock for the running timer. Keyed on having a session, not on each snapshot, so fixes
  // arriving about once a second cannot keep resetting the interval before it fires.
  const hasSession = snapshot !== null;
  useEffect(() => {
    if (!hasSession) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasSession]);

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

  // Moving time only: ticks between fixes while moving, stops when you stop, never goes backwards.
  // The run-on is timed on the phone's clock from each moving fix's arrival (advanceLiveClock).
  const clock = useRef<LiveClock | null>(null);
  if (snapshot) {
    clock.current = advanceLiveClock(clock.current, snapshot, now);
  }
  const movingS = snapshot ? (clock.current?.shownS ?? 0) : 0;

  return {
    snapshot,
    track,
    movingS,
    prepare: useCallback(() => c.recording.prepare.execute(), [c]),
    start: useCallback((type: ActivityType) => c.recording.start.execute(type), [c]),
    pause: useCallback(() => c.recording.pause.execute(), [c]),
    resume: useCallback(() => c.recording.resume.execute(), [c]),
    finish: useCallback(() => c.recording.finish.execute(), [c]),
    discard: useCallback(() => c.recording.discard.execute(), [c]),
  };
}
