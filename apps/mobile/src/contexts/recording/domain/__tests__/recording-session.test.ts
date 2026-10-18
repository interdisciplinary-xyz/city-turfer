import { distanceM, DomainError } from '@/shared-kernel';
import { loadFixes } from '@/test-support/fixtures';
import { oracleStats } from '@/test-support/oracle';

import type { Fix } from '../fix';
import { RecordingSession } from '../recording-session';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const fix = (i: number, metresNorth: number, extra: Partial<Fix> = {}): Fix => ({
  lat: 52.2 + metresNorth / 111_195,
  lon: 21,
  t: T0 + i * 1000,
  accuracy: 5,
  alt: null,
  speed: null,
  ...extra,
});

describe('RecordingSession', () => {
  it('starts recording and emits SessionStarted', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    expect(s.status).toBe('recording');
    expect(s.pullEvents().map((e) => e.type)).toEqual(['SessionStarted']);
  });

  it('accepts moving fixes and accumulates distance', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    const pts = s.ingest([0, 1, 2, 3, 4].map((i) => fix(i, i * 5)));
    expect(pts).toHaveLength(5);
    expect(s.snapshot(T0 + 4000).distanceM).toBeCloseTo(20, 0);
  });

  it('treats sub-minStep movement as jitter (run minStep = 4 m)', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    expect(s.ingest([0, 1, 2].map((i) => fix(i, i * 3)))).toHaveLength(2); // 0 m, 6 m kept; 3 m dropped
  });

  it('rejects inaccurate, out-of-order and teleporting fixes', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest([fix(0, 0), fix(1, 5)]);
    expect(s.ingest([fix(2, 10, { accuracy: 80 })])).toHaveLength(0); // inaccurate
    expect(s.ingest([fix(1, 10)])).toHaveLength(0); // not after last seen
    expect(s.ingest([fix(3, 500)])).toHaveLength(0); // 495 m in 2 s
    expect(s.ingest([fix(4, 15)])).toHaveLength(1);
  });

  it('drops fixes while paused and starts a new segment on resume (no distance across the gap)', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest([fix(0, 0), fix(1, 5), fix(2, 10)]);
    s.pause(T0 + 2500);
    expect(s.ingest([fix(3, 15)])).toHaveLength(0);
    s.resume(T0 + 60_000);
    const after = s.ingest([fix(61, 400), fix(62, 405)]);
    expect(after.every((p) => p.segment === 1)).toBe(true);
    expect(s.snapshot(T0 + 62_000).distanceM).toBeCloseTo(15, 0); // 10 + 5, not +390
  });

  it('auto-pauses when standing still and auto-resumes when moving', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest([fix(0, 0), fix(1, 5)]);
    s.ingest(Array.from({ length: 15 }, (_, i) => fix(2 + i, 5, { speed: 0 })));
    expect(s.status).toBe('autoPaused');
    s.ingest([fix(20, 15, { speed: 3 })]);
    expect(s.status).toBe('recording');
  });

  it('does not count a long fix gap as moving time even if the device reports speed', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest([fix(0, 0, { speed: 3 }), fix(2, 6, { speed: 3 })]);
    s.ingest([fix(222, 12, { speed: 3.5 })]); // 220 s gap, only 6 m covered
    expect(s.snapshot(T0 + 222_000).movingS).toBeLessThan(5);
  });

  it('starts a new segment after a long gap instead of drawing a straight line', () => {
    const s = RecordingSession.start('s1', 'cycle', T0);
    s.ingest([fix(0, 0), fix(2, 12), fix(4, 24)]);
    const r = s.ingestWithReport([fix(200, 1000), fix(202, 1012)]); // 196 s silence, ~1 km further
    expect(r.gapSplits).toBe(1);
    expect(r.points.every((p) => p.segment === 1)).toBe(true);
    expect(s.snapshot(T0 + 202_000).distanceM).toBeCloseTo(36, 0); // 24 + 12, no 976 m jump
  });

  it('reports why fixes were dropped', () => {
    const s = RecordingSession.start('s1', 'run', T0);
    const r = s.ingestWithReport([fix(0, 0), fix(1, 5, { accuracy: 90 }), fix(2, 600), fix(3, 6), fix(4, 7)]);
    expect(r.received).toBe(5);
    expect(r.rejected.inaccurate).toBe(1);
    expect(r.rejected.teleport).toBe(1);
    expect(r.jitter).toBe(1);
  });

  it.each(['finish', 'discard'] as const)('keeps no position once closed (%s)', (close) => {
    const s = RecordingSession.start('s1', 'run', T0);
    s.ingest([0, 1, 2].map((i) => fix(i, i * 5)));
    expect(s.toState().tail).not.toBeNull();
    s[close](T0 + 3000);
    expect(s.toState()).toMatchObject({ tail: null, recent: [], distanceM: expect.any(Number), pointCount: 3 });
    expect(JSON.stringify(s.toState())).not.toMatch(/"lat"|"lon"/);
  });

  it('refuses to finish with fewer than 2 points and makes finished terminal', () => {
    const s = RecordingSession.start('s1', 'walk', T0);
    expect(() => s.finish(T0 + 1000)).toThrow(DomainError);
    s.ingest([fix(0, 0), fix(2, 5)]);
    s.finish(T0 + 5000);
    expect(s.status).toBe('finished');
    expect(() => s.pause(T0 + 6000)).toThrow(DomainError);
    expect(s.pullEvents().map((e) => e.type)).toContain('SessionFinished');
  });

  it('matches the reference oracle on the run fixture with outliers and a pause (±3%)', () => {
    const oracle = oracleStats('run-5k-outliers-pause.gpx').distanceM; // node tools/route-stats.mjs --json
    const s = RecordingSession.start('s1', 'run', T0);
    const accepted = s.ingest(loadFixes('run-5k-outliers-pause.gpx'));
    let d = 0;
    for (let i = 1; i < accepted.length; i++) {
      d += distanceM(accepted[i - 1], accepted[i]);
    }
    expect(Math.abs(s.snapshot(0).distanceM - oracle) / oracle).toBeLessThan(0.03);
    expect(d).toBeCloseTo(s.snapshot(0).distanceM, 0);
  });

  describe('why each segment starts (Resume vs GPS gap)', () => {
    const finishedEvent = (s: RecordingSession) => {
      const e = s.pullEvents().find((x) => x.type === 'SessionFinished');
      return e as Extract<ReturnType<RecordingSession['pullEvents']>[number], { type: 'SessionFinished' }>;
    };

    it('records segments begun by a manual Resume and publishes them on SessionFinished', () => {
      const s = RecordingSession.start('s1', 'run', T0);
      s.ingest([fix(0, 0), fix(1, 5), fix(2, 10)]);
      s.pause(T0 + 2500);
      s.resume(T0 + 600_000); // segment 1: manual Resume
      s.ingest([fix(600, 400), fix(601, 405), fix(602, 410)]);
      s.ingest([fix(700, 600), fix(701, 605)]); // 98 s without fixes: segment 2 starts after a GPS gap
      expect(s.toState().segment).toBe(2);
      expect(s.toState().resumedSegments).toEqual([1]);
      s.finish(T0 + 702_000);
      expect(finishedEvent(s).resumedSegments).toEqual([1]);
    });

    it('publishes an empty list when every break was a GPS gap', () => {
      const s = RecordingSession.start('s1', 'run', T0);
      s.ingest([fix(0, 0), fix(1, 5), fix(100, 300), fix(101, 305)]);
      expect(s.toState().segment).toBe(1);
      s.finish(T0 + 102_000);
      expect(finishedEvent(s).resumedSegments).toEqual([]);
    });

    it('publishes null for a session persisted by an older build (reason unknown)', () => {
      const s = RecordingSession.start('s1', 'run', T0);
      s.ingest([fix(0, 0), fix(1, 5)]);
      const { resumedSegments: _drop, ...legacy } = s.toState();
      const old = RecordingSession.rehydrate(legacy);
      old.pause(T0 + 2000);
      old.resume(T0 + 3000);
      expect(old.toState().resumedSegments).toBeUndefined(); // stays unknown, never half-known
      old.finish(T0 + 4000);
      expect(finishedEvent(old).resumedSegments).toBeNull();
    });
  });

  describe('assertMayReplace (persistence guard)', () => {
    it.each(['finished', 'discarded'] as const)('refuses to replace a %s session', (persisted) => {
      const stale = RecordingSession.start('s1', 'run', T0);
      expect(() => stale.assertMayReplace(persisted)).toThrow(DomainError);
      expect(() => stale.assertMayReplace(persisted)).toThrow(
        expect.objectContaining({ code: 'session.already-ended' })
      );
    });

    it.each(['recording', 'paused', 'autoPaused'] as const)('may replace a %s session', (persisted) => {
      const s = RecordingSession.start('s1', 'run', T0);
      s.ingest([fix(0, 0), fix(1, 5)]);
      s.finish(T0 + 5000);
      expect(() => s.assertMayReplace(persisted)).not.toThrow();
    });
  });
});
