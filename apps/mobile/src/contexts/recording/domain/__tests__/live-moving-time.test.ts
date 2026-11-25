import type { ActivityType } from '@/shared-kernel';

import type { Fix } from '../fix';
import { advanceLiveClock, type LiveClock } from '../live-moving-time';
import { type LiveSnapshot, RecordingSession } from '../recording-session';
import { trackingProfileFor } from '../tracking-profile';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const fix = (sec: number, metresNorth: number): Fix => ({
  lat: 52.2 + metresNorth / 111_195,
  lon: 21,
  t: T0 + sec * 1000,
  accuracy: 5,
  alt: null,
  speed: null,
});
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const at = (sec: number) => T0 + sec * 1000;
const WALK_RUN_ON_S = trackingProfileFor('walk').liveRunOnS;

interface Walk {
  readonly type?: ActivityType;
  readonly cadenceS: number; // seconds between fixes
  readonly speedMps: number;
  readonly movingFixes: number;
  readonly stillFixes?: number; // fixes at the same spot after moving (jitter)
  readonly skewS?: number; // phone clock minus GPS clock
  readonly latencyS?: number; // fix delivery delay on the phone's clock
  readonly tickPhaseS?: number; // where the 1 Hz UI tick falls between fixes
}

/**
 * Replays the Record screen: each fix reaches IngestFixes at phone time (GPS time + skew +
 * latency), which publishes a snapshot computed at that phone time; the hook renders on each
 * publish (with the last tick's `now`) and on each 1 Hz tick. Returns what each tick shows, with
 * tick times in seconds since the first fix arrived (phone clock).
 */
function replay(w: Walk) {
  const { type = 'walk', cadenceS, speedMps, movingFixes, stillFixes = 0 } = w;
  const { skewS = 0, latencyS = 0, tickPhaseS = 0.5 } = w;
  const origin = at(skewS + latencyS); // phone time the first fix arrives
  const session = RecordingSession.start('s1', type, origin);
  const events: { p: number; fix?: Fix }[] = [];
  const total = movingFixes + stillFixes;
  for (let i = 0; i < total; i++) {
    const f = fix(i * cadenceS, Math.min(i, movingFixes - 1) * cadenceS * speedMps);
    events.push({ p: origin + i * cadenceS * 1000, fix: f });
  }
  for (let p = tickPhaseS * 1000; p < (total * cadenceS + 15) * 1000; p += 1000) {
    events.push({ p: origin + p });
  }
  events.sort((a, b) => a.p - b.p || (a.fix ? -1 : 1));
  let clock: LiveClock | null = null;
  let snap: LiveSnapshot | null = null;
  let now = origin;
  const ticks: { p: number; shownS: number }[] = [];
  for (const e of events) {
    if (e.fix) {
      session.ingest([e.fix]);
      snap = session.snapshot(e.p);
    } else {
      now = e.p;
    }
    if (snap) {
      clock = advanceLiveClock(clock, snap, now);
      if (!e.fix) {
        ticks.push({ p: (e.p - origin) / 1000, shownS: clock.shownS });
      }
    }
  }
  return { ticks, final: snap!, firstMoving: cadenceS, lastMoving: (movingFixes - 1) * cadenceS };
}

/** Longest run of consecutive ticks in [from, until] showing the same value. */
function longestHold(ticks: { p: number; shownS: number }[], from: number, until: number): number {
  const window = ticks.filter((t) => t.p >= from && t.p <= until);
  let longest = 1,
    run = 1;
  for (let i = 1; i < window.length; i++) {
    run = window[i]!.shownS === window[i - 1]!.shownS ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

describe('live moving time (Record screen clock)', () => {
  it('counts only moving time: standing still does not tick, unlike active time', () => {
    const s = RecordingSession.start('s1', 'walk', T0);
    // 60 s walking at 1.4 m/s, then 10 s standing (under the walk auto-pause delay).
    s.ingest(range(0, 60).map((i) => fix(i, i * 1.4)));
    s.ingest(range(61, 70).map((i) => fix(i, 84)));
    const snap = s.snapshot(at(70));
    expect(snap.lastMovingAt).toBeNull();
    expect(advanceLiveClock(null, snap, at(70)).shownS).toBe(snap.movingS);
    expect(snap.movingS).toBeLessThanOrEqual(61);
    expect(snap.activeS).toBe(70);
    // Still not ticking much later.
    expect(advanceLiveClock(null, snap, at(90)).shownS).toBe(snap.movingS);
  });

  it('runs on from the moving fix arrival, at most the profile run-on', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 30).map((i) => fix(i, i * 3)));
    const snap = s.snapshot(at(30));
    expect(snap.lastMovingAt).toBe(at(30));
    const first = advanceLiveClock(null, snap, at(30));
    expect(first.shownS).toBe(snap.movingS);
    expect(advanceLiveClock(first, snap, at(31)).shownS).toBe(snap.movingS + 1);
    expect(advanceLiveClock(first, snap, at(60)).shownS).toBe(snap.movingS + trackingProfileFor('run').liveRunOnS);
  });

  it('times the run-on from when a moving fix first arrives, not from a republished snapshot', () => {
    const s = RecordingSession.start('s1', 'walk', T0);
    s.ingest(range(0, 30).map((i) => fix(i, i * 1.4)));
    const snap = s.snapshot(at(30));
    const atThree = advanceLiveClock(advanceLiveClock(null, snap, at(30)), snap, at(33));
    expect(atThree.shownS).toBe(snap.movingS + 3);
    // A jitter-only batch republishes the same lastMovingAt, computed later: the run-on goes on.
    const republished = { ...snap, computedAt: at(33) };
    expect(advanceLiveClock(atThree, republished, at(40)).shownS).toBe(snap.movingS + WALK_RUN_ON_S);
    // A new moving fix restarts the run-on from its own arrival.
    const next = { ...snap, movingS: snap.movingS + 10, lastMovingAt: at(40), computedAt: at(41) };
    expect(advanceLiveClock(atThree, next, at(43)).shownS).toBe(snap.movingS + 12);
  });

  it('stops while paused and does not jump after a manual resume', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 30).map((i) => fix(i, i * 3)));
    s.pause(at(31));
    expect(s.snapshot(at(100)).lastMovingAt).toBeNull();
    s.resume(at(200));
    const snap = s.snapshot(at(201));
    expect(snap.lastMovingAt).toBeNull();
    expect(advanceLiveClock(null, snap, at(201)).shownS).toBe(snap.movingS);
  });

  it('each profile run-on covers one accepted fix at the slowest moving pace (minStepM / movingSpeedMps)', () => {
    for (const type of ['walk', 'run', 'cycle'] as const) {
      const p = trackingProfileFor(type);
      expect(p.liveRunOnS).toBeGreaterThanOrEqual(p.minStepM / p.movingSpeedMps);
    }
  });

  describe.each([
    { label: '4 s walk cadence (Android fused, 1.4 m/s)', cadenceS: 4, speedMps: 1.4 },
    { label: '6 s walk cadence (Android fused, 0.7 m/s)', cadenceS: 6, speedMps: 0.7 },
    { label: '6 s walk cadence (iOS 1 Hz, every 3rd fix accepted at 0.55 m/s)', cadenceS: 6, speedMps: 0.55 },
  ])('$label', ({ cadenceS, speedMps }) => {
    it.each([
      { tickPhaseS: 0, latencyS: 0 },
      { tickPhaseS: 0.5, latencyS: 0 },
      { tickPhaseS: 0.9, latencyS: 0.3 },
      { tickPhaseS: 0.2, latencyS: 1.5 },
    ])('never holds more than one tick while moving (tick phase $tickPhaseS s, latency $latencyS s)', (timing) => {
      const { ticks, firstMoving, lastMoving } = replay({ cadenceS, speedMps, movingFixes: 20, ...timing });
      expect(longestHold(ticks, firstMoving, lastMoving)).toBeLessThanOrEqual(2);
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]!.shownS).toBeGreaterThanOrEqual(ticks[i - 1]!.shownS);
      }
    });

    it('stops within the run-on once you stand still', () => {
      const { ticks, final, lastMoving } = replay({ cadenceS, speedMps, movingFixes: 20, stillFixes: 3 });
      const after = ticks.filter((t) => t.p >= lastMoving + WALK_RUN_ON_S);
      expect(new Set(after.map((t) => t.shownS)).size).toBe(1);
      expect(after[0]!.shownS).toBeGreaterThanOrEqual(final.movingS);
      expect(after[0]!.shownS).toBeLessThanOrEqual(final.movingS + WALK_RUN_ON_S);
    });

    it('shows the same clock whether the phone is 10 s ahead of, level with or 10 s behind GPS time', () => {
      const shownWith = (skewS: number) =>
        replay({ cadenceS, speedMps, movingFixes: 20, stillFixes: 3, skewS, latencyS: 0.4 }).ticks.map((t) => t.shownS);
      const level = shownWith(0);
      expect(shownWith(10)).toEqual(level);
      expect(shownWith(-10)).toEqual(level);
    });
  });
});
