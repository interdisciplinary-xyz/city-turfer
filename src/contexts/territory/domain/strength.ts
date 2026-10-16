import { DomainError } from '@/shared-kernel';

import type { StrengthTier } from '../contract';

/**
 * Turf is permanent (docs/poc-plan.md §9): strength depends only on visits.
 * Must match tools/turf-preview.mjs: strength = 1 − exp(−visits / k).
 */
export const TURF_SATURATION_K = 3;

export function strengthOf(visits: number, k = TURF_SATURATION_K): number {
  if (!Number.isFinite(visits) || visits < 1) throw new DomainError('turf.no-visits', String(visits));
  return 1 - Math.exp(-visits / k);
}

export function tierOf(strength: number): StrengthTier {
  if (strength < 0.33) return 'faint';
  if (strength < 0.66) return 'glowing';
  if (strength < 0.9) return 'strong';
  return 'blazing';
}
