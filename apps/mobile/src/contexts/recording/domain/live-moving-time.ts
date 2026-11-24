import type { LiveSnapshot } from './recording-session';

/**
 * How far the live clock may run on past the last moving fix before the next fix confirms it.
 * Fixes come every 1–2 s while moving (TrackingProfile), so 3 s covers one late fix.
 */
export const LIVE_MOVING_RUN_ON_S = 3;

/**
 * Moving time to show on the Record screen at `now`: the session's moving time, running on from
 * the last moving fix while still recording, so the clock ticks between fixes and stops when you
 * stop (it never counts stopped or paused time).
 */
export function liveMovingS(snapshot: LiveSnapshot, now: number): number {
  const runOnS =
    snapshot.lastMovingAt != null
      ? Math.min(LIVE_MOVING_RUN_ON_S, Math.max(0, (now - snapshot.lastMovingAt) / 1000))
      : 0;
  return Math.floor(snapshot.movingS + runOnS);
}
