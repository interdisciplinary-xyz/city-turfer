import type { GeoPoint } from './geo';

/** A Fix that passed the Fix Filter and became part of the route. SI units. */
export interface TrackPoint extends GeoPoint {
  readonly t: number; // epoch ms, from the fix
  readonly segment: number;
  readonly alt: number | null;
  readonly accuracy: number | null;
  readonly speed: number | null; // m/s, null when the device didn't report it
}

/** Ordered Segments; each Resume starts a new one. Never draw or measure across segments. */
export interface Track {
  readonly segments: readonly (readonly TrackPoint[])[];
}

export function trackFromPoints(points: readonly TrackPoint[]): Track {
  const bySegment = new Map<number, TrackPoint[]>();
  for (const p of points) {
    const seg = bySegment.get(p.segment) ?? [];
    seg.push(p);
    bySegment.set(p.segment, seg);
  }
  return {
    segments: [...bySegment.entries()].sort(([a], [b]) => a - b).map(([, pts]) => pts.sort((x, y) => x.t - y.t)),
  };
}

export const pointsOf = (track: Track): TrackPoint[] => track.segments.flat();

/** A gap longer than this (no fixes at all) starts a new segment: never draw, measure or claim across it. */
export const MAX_FIX_GAP_MS = 45_000;

/**
 * Renumbers segments 0..n so that every original segment boundary is kept and
 * every time gap longer than `maxGapMs` starts a new segment. Pure.
 */
export function splitAtGaps(points: readonly TrackPoint[], maxGapMs = MAX_FIX_GAP_MS): TrackPoint[] {
  const out: TrackPoint[] = [];
  let seg = -1;
  let prev: TrackPoint | null = null;
  for (const p of pointsOf(trackFromPoints(points))) {
    if (!prev || p.segment !== prev.segment || p.t - prev.t > maxGapMs) seg++;
    out.push({ ...p, segment: seg });
    prev = p;
  }
  return out;
}

export const segmentCount = (points: readonly TrackPoint[]): number => new Set(points.map((p) => p.segment)).size;
