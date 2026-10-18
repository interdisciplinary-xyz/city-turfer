import { MAX_FIX_GAP_MS } from '@/constants/tracking';
import { type ActivityType, distanceM } from '@/shared-kernel';

import type { Fix } from '../fix';
import { RecordingSession } from '../recording-session';
import { trackingProfileFor } from '../tracking-profile';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const fixAtMs = (ms: number, metresNorth: number, extra: Partial<Fix> = {}): Fix => ({
  lat: 52.2 + metresNorth / 111_195,
  lon: 21,
  t: T0 + ms,
  accuracy: 5,
  alt: null,
  speed: null,
  ...extra,
});
const fix = (sec: number, metresNorth: number, extra: Partial<Fix> = {}) => fixAtMs(sec * 1000, metresNorth, extra);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** Deterministic GPS wander of up to ±1 m around a point while standing. */
const wobble = (i: number) => Math.sin(i * 1.7);
const sumOfSteps = (pts: { lat: number; lon: number }[]) =>
  pts.slice(1).reduce((d, p, i) => d + distanceM(pts[i], p), 0);

describe('auto-pause resume without Doppler speed (regression)', () => {
  // 20 s moving, 80 s standing, 100 s moving at 3 m/s, speed always null (no Doppler).
  const repro = () => [
    ...range(0, 20).map((i) => fix(i, i * 3)),
    ...range(21, 100).map((i) => fix(i, 60 + wobble(i))),
    ...range(101, 200).map((i) => fix(i, 60 + (i - 100) * 3)),
  ];

  it('resumes after a long auto-pause and keeps the moving points', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    const r = s.ingestWithReport(repro());
    expect(s.status).toBe('recording');
    expect(r.gapSplits).toBe(0);
    const after = r.points.filter((p) => p.t > T0 + 100_000);
    expect(after.length).toBeGreaterThanOrEqual(45); // 3 m/fix with minStep 4 → ~every 2nd fix
    expect(after[after.length - 1].t).toBeGreaterThanOrEqual(T0 + 199_000);
    expect(r.points.every((p) => p.segment === 0)).toBe(true);
    const snap = s.snapshot(T0 + 200_000);
    expect(snap.distanceM).toBeGreaterThan(340); // 60 + 300 (minus a step lost to the resume)
    expect(snap.distanceM).toBeLessThan(375);
    expect(sumOfSteps(r.points)).toBeCloseTo(snap.distanceM, 0); // drawn line == counted distance
    const events = s.pullEvents();
    const resumed = events.find((e) => e.type === 'SessionResumed');
    expect(events.filter((e) => e.type === 'SessionPaused')).toHaveLength(1);
    expect(resumed?.at).toBeLessThanOrEqual(T0 + 103_000); // within a few steps, not ~40 s later
  });

  it('behaves the same when the batch arrives one fix at a time (background delivery)', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    const pts = repro().flatMap((f) => s.ingest([f]));
    expect(s.status).toBe('recording');
    expect(pts.filter((p) => p.t > T0 + 100_000).length).toBeGreaterThanOrEqual(45);
  });

  it('resumes promptly after a 10-minute stop', () => {
    const s = RecordingSession.start('s1', 'walk', T0);
    s.ingest(range(0, 20).map((i) => fix(i, i * 1.4)));
    s.ingest(range(21, 620).map((i) => fix(i, 28 + wobble(i))));
    expect(s.status).toBe('autoPaused');
    s.pullEvents();
    s.ingest(range(621, 640).map((i) => fix(i, 28 + (i - 620) * 1.4)));
    expect(s.status).toBe('recording');
    const resumed = s.pullEvents().find((e) => e.type === 'SessionResumed');
    // No Doppler: the pause anchor can be up to 10 s old, so allow one anchor hop (~2 minSteps).
    expect(resumed?.at).toBeLessThanOrEqual(T0 + 626_000);
  });

  it('does not resume on stationary wander alone', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 20).map((i) => fix(i, i * 3)));
    s.ingest(range(21, 400).map((i) => fix(i, 60 + wobble(i))));
    expect(s.status).toBe('autoPaused');
  });

  it('a real outage while auto-paused splits the segment and still resumes without Doppler', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 20).map((i) => fix(i, i * 3)));
    s.ingest(range(21, 40).map((i) => fix(i, 60)));
    expect(s.status).toBe('autoPaused');
    // 60 s of silence (OS suspended us), then the runner is already moving 200 m further on.
    const r = s.ingestWithReport(range(100, 130).map((i) => fix(i, 260 + (i - 100) * 3)));
    expect(r.gapSplits).toBe(1);
    expect(s.status).toBe('recording');
    expect(r.points.length).toBeGreaterThan(10);
    expect(r.points.every((p) => p.segment === 1)).toBe(true);
    expect(s.snapshot(T0 + 130_000).distanceM).toBeLessThan(160); // 60 + ~90, never the 200 m jump
  });

  it('rehydrates a state saved before lastSeen/pauseAnchor existed', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest(range(0, 20).map((i) => fix(i, i * 3)));
    s.ingest(range(21, 60).map((i) => fix(i, 60)));
    const { lastSeen: _ls, pauseAnchor: _pa, ...legacy } = s.toState();
    const r = RecordingSession.rehydrate(JSON.parse(JSON.stringify(legacy)));
    expect(r.status).toBe('autoPaused');
    r.ingest(range(61, 80).map((i) => fix(i, 60 + (i - 60) * 3)));
    expect(r.status).toBe('recording');
  });
});

describe.each<ActivityType>(['walk', 'run', 'cycle'])('auto-pause thresholds (%s profile)', (type) => {
  const p = trackingProfileFor(type);
  const step = p.minStepM + 1;
  /** Two moving fixes, then standing still with speed 0 from t = 3 s. */
  const standingFrom3 = (s: RecordingSession, untilSec: number) => {
    s.ingest([fix(0, 0, { speed: p.movingSpeedMps + 1 }), fix(2, step, { speed: p.movingSpeedMps + 1 })]);
    s.ingest(range(3, untilSec).map((i) => fix(i, step, { speed: 0 })));
  };

  it(`auto-pauses only after ${p.autoPauseAfterS} s below ${p.movingSpeedMps} m/s`, () => {
    const s = RecordingSession.start('s1', type, T0);
    standingFrom3(s, 3 + p.autoPauseAfterS - 1);
    expect(s.status).toBe('recording');
    s.ingest([fix(3 + p.autoPauseAfterS, step, { speed: 0 })]);
    expect(s.status).toBe('autoPaused');
    const paused = s.pullEvents().find((e) => e.type === 'SessionPaused');
    expect(paused).toMatchObject({ auto: true, at: T0 + (3 + p.autoPauseAfterS) * 1000 });
  });

  it('a moving fix resets the slow timer', () => {
    const s = RecordingSession.start('s1', type, T0);
    standingFrom3(s, 3 + p.autoPauseAfterS - 1);
    s.ingest([fix(3 + p.autoPauseAfterS, step, { speed: p.movingSpeedMps })]); // fresh Doppler, jitter position
    s.ingest([fix(4 + p.autoPauseAfterS, step, { speed: 0 })]);
    expect(s.status).toBe('recording');
  });

  it(`resumes at exactly ${p.movingSpeedMps} m/s, not just below`, () => {
    const s = RecordingSession.start('s1', type, T0);
    standingFrom3(s, 3 + p.autoPauseAfterS);
    const t = 4 + p.autoPauseAfterS;
    s.ingest([fix(t, step, { speed: p.movingSpeedMps - 0.01 })]);
    expect(s.status).toBe('autoPaused');
    s.ingest([fix(t + 1, step, { speed: p.movingSpeedMps })]);
    expect(s.status).toBe('recording');
    expect(s.pullEvents().find((e) => e.type === 'SessionResumed')).toMatchObject({ auto: true, segment: 0 });
  });

  it('auto-pause → manual pause → manual resume: one pause span, new segment, no gap split', () => {
    const s = RecordingSession.start('s1', type, T0);
    const pauseAt = 3 + p.autoPauseAfterS;
    standingFrom3(s, pauseAt);
    expect(s.status).toBe('autoPaused');
    s.pause(T0 + (pauseAt + 5) * 1000);
    expect(s.status).toBe('paused');
    expect(s.ingestWithReport([fix(pauseAt + 6, step + 50)]).ignoredWhilePaused).toBe(1);
    const resumeAt = pauseAt + 120; // longer than MAX_FIX_GAP_MS
    s.resume(T0 + resumeAt * 1000);
    expect(s.status).toBe('recording');
    const r = s.ingestWithReport(range(resumeAt + 1, resumeAt + 4).map((i) => fix(i, 500 + (i - resumeAt) * step)));
    expect(r.gapSplits).toBe(0);
    expect(r.points.length).toBeGreaterThan(0);
    expect(r.points.every((pt) => pt.segment === 1)).toBe(true);
    // Paused from the auto-pause instant, not from the manual tap.
    const snap = s.snapshot(T0 + (resumeAt + 4) * 1000);
    expect(snap.activeS).toBe(pauseAt + 4);
    const types = s.pullEvents().map((e) => [e.type, 'auto' in e ? e.auto : undefined]);
    expect(types).toEqual(
      expect.arrayContaining([
        ['SessionPaused', true],
        ['SessionPaused', false],
        ['SessionResumed', false],
      ])
    );
  });
});

describe('segment gaps (MAX_FIX_GAP_MS)', () => {
  const start = () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest([fix(0, 0), fix(2, 6), fix(4, 12)]);
    return s;
  };

  it('a silence just under the limit keeps the segment', () => {
    const s = start();
    const r = s.ingestWithReport([fixAtMs(4000 + MAX_FIX_GAP_MS - 1, 40)]);
    expect(r.gapSplits).toBe(0);
    expect(r.points[0].segment).toBe(0);
  });

  it('a silence exactly at the limit keeps the segment', () => {
    const r = start().ingestWithReport([fixAtMs(4000 + MAX_FIX_GAP_MS, 40)]);
    expect(r.gapSplits).toBe(0);
  });

  it('a silence just over the limit starts a new segment and adds no distance', () => {
    const s = start();
    const r = s.ingestWithReport([fixAtMs(4000 + MAX_FIX_GAP_MS + 1, 40), fixAtMs(4000 + MAX_FIX_GAP_MS + 2001, 46)]);
    expect(r.gapSplits).toBe(1);
    expect(r.points.map((p) => p.segment)).toEqual([1, 1]);
    expect(s.snapshot(0).distanceM).toBeCloseTo(18, 0); // 12 + 6
  });

  it('counts several splits in one batch', () => {
    const s = start();
    const r = s.ingestWithReport([fix(60, 100), fix(62, 106), fix(120, 300), fix(122, 306), fix(124, 312)]);
    expect(r.gapSplits).toBe(2);
    expect(r.points.map((p) => p.segment)).toEqual([1, 1, 2, 2, 2]);
  });

  it('measures the gap from the last fix seen, so a long auto-pause with fixes is not a gap', () => {
    const s = start();
    s.ingest(range(5, 200).map((i) => fix(i, 12 + wobble(i))));
    expect(s.status).toBe('autoPaused');
    const r = s.ingestWithReport(range(201, 210).map((i) => fix(i, 12 + (i - 200) * 3)));
    expect(r.gapSplits).toBe(0);
    expect(s.status).toBe('recording');
  });

  it('fixes rejected during the silence do not keep the segment alive', () => {
    const s = start();
    const r = s.ingestWithReport([fix(30, 50, { accuracy: 90 }), fix(60, 60)]);
    expect(r.rejected.inaccurate).toBe(1);
    expect(r.gapSplits).toBe(1);
  });
});
