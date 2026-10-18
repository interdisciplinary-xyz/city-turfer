import { distanceM, type Track, trackFromPoints, type TrackPoint } from '@/shared-kernel';

import { Activity } from '../activity';
import {
  acceptRoute,
  estimatedMovingS,
  estimatedTotals,
  type Gap,
  gapsOf,
  MAX_DETOUR,
  MAX_GAP_SPEED_MPS,
  MIN_GAP_M,
  PRIVATE_ENDPOINT_RADIUS_M,
  routableGaps,
} from '../gap-route';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const LAT0 = 52.2;
const LON0 = 21;
const M_PER_DEG_LAT = 111_195; // matches EARTH_RADIUS_M for small offsets along a meridian

/** A point `north` metres north of the origin, `s` seconds after T0. */
const pt = (north: number, s: number, segment: number): TrackPoint => ({
  lat: LAT0 + north / M_PER_DEG_LAT,
  lon: LON0,
  t: T0 + s * 1000,
  segment,
  alt: null,
  accuracy: 5,
  speed: null,
});

/** Segments as [startNorth, endNorth, startS, endS, segmentNumber]. */
const track = (...segs: [number, number, number, number, number][]): Track =>
  trackFromPoints(segs.flatMap(([n0, n1, s0, s1, seg]) => [pt(n0, s0, seg), pt(n1, s1, seg)]));

const gap = (over: Partial<Gap> = {}): Gap => ({
  afterSegment: 0,
  from: pt(0, 0, 0),
  to: pt(1000, 600, 1),
  durationS: 600,
  straightM: 1000,
  cause: 'gap',
  ...over,
});

describe('gapsOf', () => {
  it(`skips breaks shorter than MIN_GAP_M (${MIN_GAP_M} m) and keeps those at or above it`, () => {
    const at = (m: number) => gapsOf(track([0, 1000, 0, 300, 0], [1000 + m, 2000, 400, 700, 1]));
    expect(at(24)).toEqual([]);
    const g = at(25.01);
    expect(g).toHaveLength(1);
    expect(g[0].straightM).toBeGreaterThanOrEqual(MIN_GAP_M);
    expect(g[0].straightM).toBeCloseTo(25.01, 1);
  });

  it('measures the break from the last point of one segment to the first of the next', () => {
    const t = track([0, 1000, 0, 300, 0], [1500, 2000, 420, 700, 1]);
    const [g] = gapsOf(t);
    expect(g.afterSegment).toBe(0);
    expect(g.from).toBe(t.segments[0][1]);
    expect(g.to).toBe(t.segments[1][0]);
    expect(g.durationS).toBe(120);
    expect(g.straightM).toBeCloseTo(distanceM(g.from, g.to), 6);
  });

  it('handles empty tracks, single segments and empty segments', () => {
    expect(gapsOf({ segments: [] })).toEqual([]);
    expect(gapsOf(track([0, 1000, 0, 300, 0]))).toEqual([]);
    const withEmpty: Track = { segments: [[pt(0, 0, 0), pt(500, 100, 0)], [], [pt(900, 300, 2), pt(1200, 400, 2)]] };
    expect(gapsOf(withEmpty)).toEqual([]); // never routes across an empty segment
  });

  it('finds every break in a track with three or more segments, indexed by segment position', () => {
    const t = track(
      [0, 500, 0, 100, 0],
      [600, 1000, 200, 300, 1],
      [1000, 1500, 400, 500, 2],
      [1700, 2000, 600, 700, 3]
    );
    const gaps = gapsOf(t);
    expect(gaps.map((g) => g.afterSegment)).toEqual([0, 2]); // 0 m between segments 1 and 2: skipped
    expect(gaps.map((g) => Math.round(g.straightM))).toEqual([100, 200]);
  });

  it('never reports a negative duration', () => {
    const [g] = gapsOf(track([0, 1000, 0, 300, 0], [1500, 2000, 250, 700, 1]));
    expect(g.durationS).toBe(0);
  });

  it('tells a manual Resume from a GPS gap by segment number', () => {
    const t = track([0, 500, 0, 100, 0], [600, 1000, 200, 300, 1], [1200, 1500, 400, 500, 2]);
    expect(gapsOf(t, [1]).map((g) => g.cause)).toEqual(['resume', 'gap']);
    expect(gapsOf(t, [2]).map((g) => g.cause)).toEqual(['gap', 'resume']);
    expect(gapsOf(t, []).map((g) => g.cause)).toEqual(['gap', 'gap']);
    expect(gapsOf(t).map((g) => g.cause)).toEqual(['unknown', 'unknown']);
    expect(gapsOf(t, null).map((g) => g.cause)).toEqual(['unknown', 'unknown']);
  });

  it('counts a break as a Resume when a skipped (empty) segment number was started by a Resume', () => {
    // Resume started segment 1 but no fix was accepted before a GPS gap began segment 2.
    const t = track([0, 500, 0, 100, 0], [700, 1000, 400, 500, 2]);
    expect(gapsOf(t, [1])[0].cause).toBe('resume');
    expect(gapsOf(t, [3])[0].cause).toBe('gap');
  });
});

describe('routableGaps', () => {
  const t = track([0, 1000, 0, 300, 0], [1500, 2500, 420, 700, 1], [3000, 4000, 800, 1100, 2]);

  it('routes GPS gaps and unknown breaks, never manual pauses', () => {
    expect(routableGaps(t, []).map((g) => g.afterSegment)).toEqual([0, 1]);
    expect(routableGaps(t, null).map((g) => g.afterSegment)).toEqual([0, 1]);
    expect(routableGaps(t, [1]).map((g) => g.afterSegment)).toEqual([1]);
    expect(routableGaps(t, [1, 2])).toEqual([]);
  });

  it(`never sends a gap ending within ${PRIVATE_ENDPOINT_RADIUS_M} m of the activity's start or end`, () => {
    const nearStart = track([0, 150, 0, 60, 0], [600, 3000, 200, 900, 1]);
    expect(routableGaps(nearStart, [])).toEqual([]);
    const nearEnd = track([0, 2500, 0, 700, 0], [2850, 3000, 820, 900, 1]);
    expect(routableGaps(nearEnd, [])).toEqual([]);
    const justOutside = track([0, 201, 0, 60, 0], [600, 3000, 200, 900, 1]);
    expect(routableGaps(justOutside, [])).toHaveLength(1);
    // A loop: the gap's far end is back near the start.
    const loop = track([0, 1500, 0, 400, 0], [100, 0, 700, 800, 1]);
    expect(routableGaps(loop, [])).toEqual([]);
  });

  it('is empty for an empty track', () => {
    expect(routableGaps({ segments: [] }, [])).toEqual([]);
  });
});

describe('acceptRoute', () => {
  it('rejects zero, negative and non-finite route lengths', () => {
    expect(acceptRoute('walk', gap(), 0)).toBe(false);
    expect(acceptRoute('walk', gap(), -5)).toBe(false);
    expect(acceptRoute('walk', gap(), Number.NaN)).toBe(false);
  });

  it('rejects gaps without a positive duration', () => {
    expect(acceptRoute('cycle', gap({ durationS: 0 }), 1200)).toBe(false);
    expect(acceptRoute('cycle', gap({ durationS: -10 }), 1200)).toBe(false);
  });

  it(`accepts a detour of exactly ${MAX_DETOUR}× the straight line and rejects anything longer`, () => {
    const g = gap({ straightM: 100, durationS: 10_000 });
    expect(acceptRoute('walk', g, 100 * MAX_DETOUR)).toBe(true);
    expect(acceptRoute('walk', g, 100 * MAX_DETOUR + 0.01)).toBe(false);
  });

  it.each([
    ['walk', 2.5],
    ['run', 6],
    ['cycle', 12],
  ] as const)('caps %s at %s m/s across the gap', (type, mps) => {
    expect(MAX_GAP_SPEED_MPS[type]).toBe(mps);
    const g = gap({ straightM: 10_000, durationS: 100 });
    expect(acceptRoute(type, g, mps * 100)).toBe(true);
    expect(acceptRoute(type, g, mps * 100 + 1)).toBe(false);
  });
});

describe('estimatedMovingS', () => {
  it('is the time the route takes at the average moving speed, never more than the gap', () => {
    expect(estimatedMovingS(600, 405, 3)).toBe(135);
    expect(estimatedMovingS(100, 405, 3)).toBe(100);
  });
  it('falls back to the gap duration without a usable average speed', () => {
    expect(estimatedMovingS(600, 405, 0)).toBe(600);
    expect(estimatedMovingS(600, 405, Number.NaN)).toBe(600);
    expect(estimatedMovingS(600, 405, Infinity)).toBe(600);
    expect(estimatedMovingS(-5, 405, 0)).toBe(0);
  });
});

describe('estimatedTotals', () => {
  it('sums distance and rounds the moving time once', () => {
    const r = (distanceM: number, movingS: number) => ({ afterSegment: 0, distanceM, movingS, coords: [] });
    expect(estimatedTotals([])).toEqual({ distanceM: 0, movingS: 0 });
    expect(estimatedTotals([r(100.5, 10.4), r(200, 20.4)])).toEqual({ distanceM: 300.5, movingS: 31 });
  });
});

describe('Activity gap estimation', () => {
  /** A 3 km run at 3 m/s (1000 s moving), with a GPS outage or a pause after 1.5 km. */
  const run = (resumedSegments: number[] | null) => {
    const t = track([0, 1500, 0, 500, 0], [1900, 3400, 1100, 1600, 1]);
    const a = Activity.record({
      id: 'a',
      type: 'run',
      startedAt: T0,
      endedAt: T0 + 1_600_000,
      track: t,
      now: T0,
      resumedSegments,
    });
    return { a, t };
  };

  it('keeps what started each segment and skips manual pauses', () => {
    expect(run([1]).a.gapsToRoute(run([1]).t)).toEqual([]);
    expect(run([]).a.gapsToRoute(run([]).t)).toHaveLength(1);
    expect(run(null).a.toState().resumedSegments).toBeNull();
  });

  it("credits moving time at the activity's average speed, capped by the gap duration", () => {
    const { a, t } = run([]);
    const [g] = a.gapsToRoute(t);
    expect(g.durationS).toBe(600);
    const avg = a.toState().summary.distanceM / a.toState().summary.movingS;
    const r = a.gapRoute(g, { distanceM: 450, coords: [[21, 52.2]] })!;
    expect(r.movingS).toBeCloseTo(450 / avg, 6);
    expect(r.movingS).toBeLessThan(g.durationS);
    expect(a.gapRoute(g, { distanceM: 450 * 10, coords: [] })).toBeNull(); // detour too long
  });

  it('caps routes stored before the moving-time rule (data repair)', () => {
    const { a } = run(null);
    const old = { afterSegment: 0, distanceM: 405, movingS: 600, coords: [] };
    const capped = a.capGapRoute(old);
    expect(capped.movingS).toBeLessThan(600);
    expect(a.capGapRoute(capped)).toBe(capped); // idempotent: unchanged routes are returned as is
  });

  it('forgets resume info when a correction renumbers the segments', () => {
    const { a, t } = run([1]);
    a.correctTrack(t, T0);
    expect(a.toState().resumedSegments).toBeNull();
  });
});
