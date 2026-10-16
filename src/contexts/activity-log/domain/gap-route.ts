import { type ActivityType, distanceM, type GeoPoint, type Track } from '@/shared-kernel';

/** A recording gap between two consecutive Segments. */
export interface Gap {
  readonly afterSegment: number; // index into track.segments
  readonly from: GeoPoint;
  readonly to: GeoPoint;
  readonly durationS: number;
  readonly straightM: number;
}

/** A street route estimated for a Gap. Display + distance only: never Turf. */
export interface GapRoute {
  readonly afterSegment: number;
  readonly distanceM: number;
  readonly movingS: number;
  readonly coords: readonly [number, number][]; // [lon, lat]
}

/** Gaps shorter than this are already drawn well enough by the dashed connector. */
const MIN_GAP_M = 25;
/** Upper speed bound per type: faster than this across a gap means another mode of transport (tram, car…). */
const MAX_GAP_SPEED_MPS: Record<ActivityType, number> = { walk: 2.5, run: 6, cycle: 12 };
/** A route this much longer than the straight line is not a plausible path for the gap. */
const MAX_DETOUR = 4;

export function gapsOf(track: Track): Gap[] {
  const gaps: Gap[] = [];
  track.segments.forEach((seg, i) => {
    const next = track.segments[i + 1];
    if (!next || seg.length === 0 || next.length === 0) return;
    const a = seg[seg.length - 1];
    const b = next[0];
    const straightM = distanceM(a, b);
    if (straightM < MIN_GAP_M) return;
    gaps.push({ afterSegment: i, from: a, to: b, durationS: Math.max(0, (b.t - a.t) / 1000), straightM });
  });
  return gaps;
}

/** Accept a routed distance for a gap only if a person of this activity type could have covered it in that time. */
export function acceptRoute(type: ActivityType, gap: Gap, routeM: number): boolean {
  if (routeM <= 0 || routeM > gap.straightM * MAX_DETOUR) return false;
  return gap.durationS > 0 && routeM / gap.durationS <= MAX_GAP_SPEED_MPS[type];
}

export const estimatedTotals = (routes: readonly GapRoute[]) => ({
  distanceM: routes.reduce((s, r) => s + r.distanceM, 0),
  movingS: Math.round(routes.reduce((s, r) => s + r.movingS, 0)),
});
