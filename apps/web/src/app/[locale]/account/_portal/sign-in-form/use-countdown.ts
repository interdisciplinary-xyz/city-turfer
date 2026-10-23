'use client';

import { useLayoutEffect, useState } from 'react';

import { secondsUntil } from './sign-in-form.constants';

/**
 * Seconds left until `until` (ms since epoch), ticking once a second; 0 when null or past. The
 * interval stops at 0, so a finished countdown doesn't re-render the form every second.
 */
export function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  // Layout effect: catch up `now` before paint, so a new countdown never flashes a stale wait.
  useLayoutEffect(() => {
    if (until === null) {
      return undefined;
    }
    setNow(Date.now());
    if (until <= Date.now()) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= until) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return secondsUntil(until, now);
}
