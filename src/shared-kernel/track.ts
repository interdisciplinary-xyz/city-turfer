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
