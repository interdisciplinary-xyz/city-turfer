import type { LiveSnapshot } from './recording-session';
import { trackingProfileFor } from './tracking-profile';

/**
 * What the Record screen's moving-time clock showed last, carried from one render to the next.
 * Every time in it is the phone's clock: GPS time (`lastMovingAt` is `fix.t`) is only compared
 * with itself, to notice a new moving fix, so a skewed GNSS clock or a late batch cannot stretch
 * or swallow the run-on.
 */
export interface LiveClock {
  readonly sessionId: string;
  /** The snapshot's `lastMovingAt` (GPS time) as last seen: a different value is a new moving fix. */
  readonly lastMovingAt: number | null;
  /** Phone time (`snapshot.computedAt`) when that moving fix first arrived; null when not moving. */
  readonly runOnFrom: number | null;
  /** Whole seconds shown; never goes down within a session. */
  readonly shownS: number;
}

/**
 * The Record screen clock at phone time `now`: the session's moving time, running on from the
 * arrival of the last moving fix (at most the profile's `liveRunOnS`) so it ticks between fixes
 * and stops when you stop. It never counts stopped or paused time and is never shown going
 * backwards: an overshoot at a stop is held until moving time catches up.
 */
export function advanceLiveClock(prev: LiveClock | null, snapshot: LiveSnapshot, now: number): LiveClock {
  const same = prev !== null && prev.sessionId === snapshot.sessionId;
  let runOnFrom: number | null = null;
  if (snapshot.lastMovingAt !== null) {
    runOnFrom = same && prev.lastMovingAt === snapshot.lastMovingAt ? prev.runOnFrom : snapshot.computedAt;
  }
  const capS = trackingProfileFor(snapshot.type).liveRunOnS;
  const runOnS = runOnFrom !== null ? Math.min(capS, Math.max(0, (now - runOnFrom) / 1000)) : 0;
  const s = Math.floor(snapshot.movingS + runOnS);
  return {
    sessionId: snapshot.sessionId,
    lastMovingAt: snapshot.lastMovingAt,
    runOnFrom,
    shownS: same ? Math.max(s, prev.shownS) : s,
  };
}
