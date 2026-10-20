import { DomainError } from '@/shared-kernel';

/**
 * What may leave the phone. Activity ids tell where an Activity came from (published language of
 * Activity Log and Health Sync): `demo-…` is generated demo history, `hk-…` an Apple Health import,
 * anything else a CityTurfer recording.
 */
export type ActivitySourceKind = 'recording' | 'apple-health' | 'demo';

const DEMO_PREFIX = 'demo-';
const APPLE_HEALTH_PREFIX = 'hk-';

/** The server's limit on track points per Activity (contract: Track.points maxItems). */
export const MAX_TRACK_POINTS = 40_000;

export function sourceOf(activityId: string): ActivitySourceKind {
  if (activityId.startsWith(DEMO_PREFIX)) {
    return 'demo';
  }
  return activityId.startsWith(APPLE_HEALTH_PREFIX) ? 'apple-health' : 'recording';
}

/**
 * Demo history is never uploaded; Apple Health imports only with their own consent (decision D2).
 */
export function mayUpload(activityId: string, healthIncluded: boolean): boolean {
  const kind = sourceOf(activityId);
  return kind === 'recording' || (kind === 'apple-health' && healthIncluded);
}

/** Wait before the n-th retry of one Activity: 30 s, doubling, at most 6 h. */
export function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 6 * 3_600_000);
}

/** A pasted device token, trimmed. Tokens have no whitespace inside. */
export function deviceToken(raw: string): string {
  const t = raw.trim();
  if (!t || /\s/.test(t)) {
    throw new DomainError('backup.invalid-token');
  }
  return t;
}
