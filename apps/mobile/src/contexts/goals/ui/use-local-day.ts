import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { MIDNIGHT_SLACK_MS } from './goal-card.constants';

const dayKey = () => new Date().toDateString();

/** Milliseconds from now to just after the next local midnight. */
function msToMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + MIDNIGHT_SLACK_MS;
}

/**
 * The device's local day as a key that changes at midnight with the app open (a timer) and when
 * the app returns to the front on a later day (timers sleep in the background).
 */
export function useLocalDay(): string {
  const [day, setDay] = useState(dayKey);
  useEffect(() => {
    const timer = setTimeout(() => setDay(dayKey()), msToMidnight());
    return () => clearTimeout(timer);
  }, [day]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setDay(dayKey()));
    return () => sub.remove();
  }, []);
  return day;
}
