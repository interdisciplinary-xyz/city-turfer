import { distanceM } from '@/shared-kernel';

import type { Fix } from './Fix';
import type { TrackingProfile } from './TrackingProfile';

export interface Tail {
  readonly lat: number;
  readonly lon: number;
  readonly t: number;
}

export type FixVerdict =
  | { kind: 'accept'; distanceM: number; dtS: number; speedMps: number }
  | { kind: 'reject'; reason: 'inaccurate' | 'out-of-order' | 'teleport' }
  | { kind: 'jitter'; speedMps: number };

/**
 * Fix Filter policy, in order: accuracy → ordering → speed spike → jitter.
 * `tail` is the last accepted point of the current segment (null at segment start).
 */
export function judgeFix(fix: Fix, tail: Tail | null, lastSeenT: number | null, profile: TrackingProfile): FixVerdict {
  if (fix.accuracy != null && fix.accuracy > profile.maxAccuracyM) return { kind: 'reject', reason: 'inaccurate' };
  if (lastSeenT != null && fix.t <= lastSeenT) return { kind: 'reject', reason: 'out-of-order' };
  if (!tail) return { kind: 'accept', distanceM: 0, dtS: 0, speedMps: fix.speed ?? 0 };

  const d = distanceM(tail, fix);
  const dt = (fix.t - tail.t) / 1000;
  const implied = dt > 0 ? d / dt : Infinity;
  if (implied > profile.maxSpeedMps) return { kind: 'reject', reason: 'teleport' };
  // Device (Doppler) speed is best for short intervals; across a gap it only
  // describes the last instant, so judge movement by distance actually covered.
  const speed = dt > 5 ? implied : (fix.speed ?? implied);
  if (d < profile.minStepM && dt < 10) return { kind: 'jitter', speedMps: speed };
  return { kind: 'accept', distanceM: d, dtS: dt, speedMps: speed };
}
