import { distanceM } from '@/shared-kernel';

import type { Fix } from './fix';
import type { TrackingProfile } from './tracking-profile';

/** A position at an instant: the last accepted point (tail), the last seen fix, or the pause anchor. */
export interface Tail {
  readonly lat: number;
  readonly lon: number;
  readonly t: number;
}

export type FixVerdict =
  | { kind: 'accept'; distanceM: number; dtS: number; speedMps: number }
  | { kind: 'reject'; reason: 'inaccurate' | 'out-of-order' | 'teleport' }
  | { kind: 'jitter'; speedMps: number };

/** Doppler speed is trusted only when the previous fix is at most this old (a continuous stream). */
export const DOPPLER_MAX_AGE_S = 5;
/** Below minStep but at least this long since the reference: accept anyway (keeps the track alive). */
export const JITTER_MAX_DT_S = 10;

/**
 * Fix Filter policy, in order: accuracy → ordering → speed spike → jitter.
 *
 * - `reference` is what distance is measured from: the last accepted point of the current segment
 *   (the tail), or the pause anchor while auto-paused; null at segment start.
 * - `lastSeen` is the last fix that passed the filter (accepted or jitter). Its time orders fixes
 *   and tells whether the fix stream is continuous; its position gives a speed at segment start.
 *
 * Speed (feeds auto-pause and moving time):
 * - Device (Doppler) speed is best, but only while fixes are flowing: after a silence of more than
 *   DOPPLER_MAX_AGE_S it describes just the last instant, so judge by the distance covered.
 * - A displacement below minStep is not movement. Without fresh Doppler speed a jitter fix reports
 *   0 m/s; dividing GPS wander by one second would otherwise read as walking pace and both block
 *   auto-pause and trigger false auto-resumes.
 */
export function judgeFix(
  fix: Fix,
  reference: Tail | null,
  lastSeenT: number | null,
  profile: TrackingProfile,
  lastSeen: Tail | null = null
): FixVerdict {
  if (fix.accuracy != null && fix.accuracy > profile.maxAccuracyM) return { kind: 'reject', reason: 'inaccurate' };
  if (lastSeenT != null && fix.t <= lastSeenT) return { kind: 'reject', reason: 'out-of-order' };
  if (!reference) return { kind: 'accept', distanceM: 0, dtS: 0, speedMps: segmentStartSpeed(fix, lastSeen, profile) };

  const d = distanceM(reference, fix);
  const dt = (fix.t - reference.t) / 1000;
  const implied = dt > 0 ? d / dt : Infinity;
  if (implied > profile.maxSpeedMps) return { kind: 'reject', reason: 'teleport' };
  const doppler = freshDoppler(fix, lastSeenT != null ? (fix.t - lastSeenT) / 1000 : dt);
  if (d < profile.minStepM && dt < JITTER_MAX_DT_S) return { kind: 'jitter', speedMps: doppler ?? 0 };
  return { kind: 'accept', distanceM: d, dtS: dt, speedMps: doppler ?? implied };
}

const freshDoppler = (fix: Fix, sinceLastFixS: number): number | null =>
  sinceLastFixS <= DOPPLER_MAX_AGE_S ? fix.speed : null;

/** First fix of a segment: no distance, but a speed so auto-pause can still resume without Doppler. */
function segmentStartSpeed(fix: Fix, lastSeen: Tail | null, profile: TrackingProfile): number {
  if (!lastSeen || fix.t <= lastSeen.t) return fix.speed ?? 0;
  const dt = (fix.t - lastSeen.t) / 1000;
  const d = distanceM(lastSeen, fix);
  return freshDoppler(fix, dt) ?? (d < profile.minStepM ? 0 : d / dt);
}
