import { distanceM, EARTH_RADIUS_M, type GeoPoint } from './geo';
import type { Track } from './track';

export interface Split {
  readonly km: number;
  readonly seconds: number;
}

export interface TrackStats {
  readonly distanceM: number;
  readonly movingS: number;
  readonly elapsedS: number;
  readonly elevGainM: number | null;
  readonly splits: readonly Split[];
}

/**
 * Pure track analytics. Distance is summed within segments only; moving time
 * counts intervals whose speed is at least `movingSpeed` (m/s).
 */
export function analyzeTrack(track: Track, movingSpeed: number, elevHysteresisM = 3): TrackStats {
  let distance = 0;
  let moving = 0;
  const splits: Split[] = [];
  let nextSplit = 1000;
  let movingAtLastSplit = 0;
  let first: number | null = null;
  let last: number | null = null;

  for (const seg of track.segments) {
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i];
      first = first == null ? p.t : Math.min(first, p.t);
      last = last == null ? p.t : Math.max(last, p.t);
      if (i === 0) continue;
      const prev = seg[i - 1];
      const d = distanceM(prev, p);
      const dt = (p.t - prev.t) / 1000;
      if (dt <= 0) continue;
      distance += d;
      if (d / dt >= movingSpeed) moving += dt;
      while (distance >= nextSplit) {
        splits.push({ km: nextSplit / 1000, seconds: Math.round(moving - movingAtLastSplit) });
        movingAtLastSplit = moving;
        nextSplit += 1000;
      }
    }
  }

  return {
    distanceM: distance,
    movingS: Math.round(moving),
    elapsedS: first != null && last != null ? Math.round((last - first) / 1000) : 0,
    elevGainM: elevationGain(track, elevHysteresisM),
    splits,
  };
}

/** 5-point moving average, then hysteresis, per segment. Null when no altitude data. */
export function elevationGain(track: Track, hysteresisM: number): number | null {
  let gain = 0;
  let any = false;
  for (const seg of track.segments) {
    const eles = seg.map((p) => p.alt).filter((a): a is number => a != null);
    if (eles.length < 5) continue;
    any = true;
    const smooth = eles.map((_, i) => {
      const w = eles.slice(Math.max(0, i - 2), i + 3);
      return w.reduce((s, e) => s + e, 0) / w.length;
    });
    let ref = smooth[0];
    for (const e of smooth) {
      if (e - ref >= hysteresisM) {
        gain += e - ref;
        ref = e;
      } else if (ref - e >= hysteresisM) ref = e;
    }
  }
  return any ? Math.round(gain) : null;
}

/** Douglas–Peucker in local metres. For rendering only — never simplify stored data. */
export function simplify<T extends GeoPoint>(points: readonly T[], epsilonM: number): T[] {
  if (points.length < 3) return [...points];
  const lat0 = (points[0].lat * Math.PI) / 180;
  const k = (Math.PI / 180) * EARTH_RADIUS_M;
  const xy = points.map((p) => [p.lon * k * Math.cos(lat0), p.lat * k] as const);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > epsilonM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
