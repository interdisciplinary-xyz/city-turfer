import { type ActivityType, distanceM, type GeoPoint, type Track } from '@/shared-kernel';

/**
 * Why a Segment boundary exists: a GPS gap (fixes stopped arriving), a manual Resume
 * after a pause, or unknown (activity recorded or imported without that information).
 */
export type BreakCause = 'gap' | 'resume' | 'unknown';

/** A break between two consecutive Segments of a track. */
export interface Gap {
  readonly afterSegment: number; // index into track.segments
  readonly from: GeoPoint;
  readonly to: GeoPoint;
  readonly durationS: number;
  readonly straightM: number;
  readonly cause: BreakCause;
}

/** A street route estimated for a Gap. Display + distance only: never Turf. */
export interface GapRoute {
  readonly afterSegment: number;
  readonly distanceM: number;
  readonly movingS: number;
  readonly coords: readonly [number, number][]; // [lon, lat]
}

/** Gaps shorter than this are already drawn well enough by the dashed connector. */
export const MIN_GAP_M = 25;
/** Upper speed bound per type: faster than this across a gap means another mode of transport (tram, car…). */
export const MAX_GAP_SPEED_MPS: Record<ActivityType, number> = { walk: 2.5, run: 6, cycle: 12 };
/** A route this much longer than the straight line is not a plausible path for the gap. */
export const MAX_DETOUR = 4;
/** Home privacy: gaps ending this close to where the activity started or ended are never sent to a router. */
export const PRIVATE_ENDPOINT_RADIUS_M = 200;

/**
 * Every break between non-empty consecutive Segments that is long enough to route.
 * `resumedSegments` are the Track Point segment numbers that began with a manual
 * Resume (null: unknown). A break counts as a Resume when any segment number after
 * the previous segment, up to and including the next one, was started by a Resume.
 */
export function gapsOf(track: Track, resumedSegments: readonly number[] | null = null): Gap[] {
  const gaps: Gap[] = [];
  track.segments.forEach((seg, i) => {
    const next = track.segments[i + 1];
    if (!next || seg.length === 0 || next.length === 0) return;
    const a = seg[seg.length - 1];
    const b = next[0];
    const straightM = distanceM(a, b);
    if (straightM < MIN_GAP_M) return;
    const cause: BreakCause =
      resumedSegments == null
        ? 'unknown'
        : resumedSegments.some((n) => n > a.segment && n <= b.segment)
          ? 'resume'
          : 'gap';
    gaps.push({ afterSegment: i, from: a, to: b, durationS: Math.max(0, (b.t - a.t) / 1000), straightM, cause });
  });
  return gaps;
}

/**
 * The gaps worth estimating along streets: never a manual pause (the person chose to stop),
 * never a gap touching the activity's first or last point (that is often home).
 */
export function routableGaps(track: Track, resumedSegments: readonly number[] | null): Gap[] {
  const first = track.segments.find((s) => s.length > 0)?.[0];
  const last = [...track.segments]
    .reverse()
    .find((s) => s.length > 0)
    ?.at(-1);
  if (!first || !last) return [];
  const isPrivate = (p: GeoPoint) =>
    distanceM(p, first) < PRIVATE_ENDPOINT_RADIUS_M || distanceM(p, last) < PRIVATE_ENDPOINT_RADIUS_M;
  return gapsOf(track, resumedSegments).filter((g) => g.cause !== 'resume' && !isPrivate(g.from) && !isPrivate(g.to));
}

/** Accept a routed distance for a gap only if a person of this activity type could have covered it in that time. */
export function acceptRoute(type: ActivityType, gap: Gap, routeM: number): boolean {
  if (!(routeM > 0) || routeM > gap.straightM * MAX_DETOUR) return false;
  return gap.durationS > 0 && routeM / gap.durationS <= MAX_GAP_SPEED_MPS[type];
}

/**
 * Moving time credited for an estimated route: the time it takes at the activity's own
 * average moving speed, never more than the gap lasted (the rest was standing still).
 * Without a usable average speed, the gap's duration is the only bound.
 */
export function estimatedMovingS(gapDurationS: number, routeM: number, avgMovingSpeedMps: number): number {
  const duration = Math.max(0, gapDurationS);
  if (!(avgMovingSpeedMps > 0) || !Number.isFinite(avgMovingSpeedMps)) return duration;
  return Math.min(duration, routeM / avgMovingSpeedMps);
}

export const estimatedTotals = (routes: readonly GapRoute[]) => ({
  distanceM: routes.reduce((s, r) => s + r.distanceM, 0),
  movingS: Math.round(routes.reduce((s, r) => s + r.movingS, 0)),
});
