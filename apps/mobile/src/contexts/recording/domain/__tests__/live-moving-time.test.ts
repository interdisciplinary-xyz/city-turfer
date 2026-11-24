import type { Fix } from '../fix';
import { LIVE_MOVING_RUN_ON_S, liveMovingS } from '../live-moving-time';
import { RecordingSession } from '../recording-session';

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

describe('live moving time (Record screen clock)', () => {
  it('counts only moving time: standing still does not tick, unlike active time', () => {
    const s = RecordingSession.start('s1', 'walk', T0);
    // 60 s walking at 1.4 m/s, then 10 s standing (under the walk auto-pause delay).
    s.ingest(range(0, 60).map((i) => fix(i, i * 1.4)));
    s.ingest(range(61, 70).map((i) => fix(i, 84)));
    const snap = s.snapshot(at(70));
    expect(snap.lastMovingAt).toBeNull();
    expect(liveMovingS(snap, at(70))).toBe(snap.movingS);
    expect(snap.movingS).toBeLessThanOrEqual(61);
    expect(snap.activeS).toBe(70);
    // Still not ticking much later.
    expect(liveMovingS(snap, at(90))).toBe(snap.movingS);
  });

  it('runs on between fixes while moving, at most LIVE_MOVING_RUN_ON_S past the last moving fix', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 30).map((i) => fix(i, i * 3)));
    const snap = s.snapshot(at(30));
    expect(snap.lastMovingAt).toBe(at(30));
    expect(liveMovingS(snap, at(31))).toBe(snap.movingS + 1);
    expect(liveMovingS(snap, at(60))).toBe(snap.movingS + LIVE_MOVING_RUN_ON_S);
  });

  it('stops while paused and does not jump after a manual resume', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 30).map((i) => fix(i, i * 3)));
    s.pause(at(31));
    expect(s.snapshot(at(100)).lastMovingAt).toBeNull();
    s.resume(at(200));
    const snap = s.snapshot(at(201));
    expect(snap.lastMovingAt).toBeNull();
    expect(liveMovingS(snap, at(201))).toBe(snap.movingS);
  });
});
