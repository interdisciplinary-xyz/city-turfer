import { ACTIVITY_TYPES } from '../../../constants/activity';
import { type ActivityType, DomainError } from '../../../shared-kernel';
import type { StrengthTier, TurfCellCounts } from '../contract';

/**
 * Turf is permanent (docs/poc-plan.md §9): strength depends only on visits.
 * Must match apps/mobile/tools/lib/turf.mjs (pinned by apps/mobile/tools/fixtures/turf-vectors.json): strength = 1 − exp(−visits / k).
 */
export const TURF_SATURATION_K = 3;

export function strengthOf(visits: number, k = TURF_SATURATION_K): number {
  if (!Number.isFinite(visits) || visits < 1) {
    throw new DomainError('turf.no-visits', String(visits));
  }
  return 1 - Math.exp(-visits / k);
}

export function tierOf(strength: number): StrengthTier {
  if (strength < 0.33) {
    return 'faint';
  }
  if (strength < 0.66) {
    return 'glowing';
  }
  if (strength < 0.9) {
    return 'strong';
  }
  return 'blazing';
}

/** Strong turf = tier `strong` or `blazing` (strength >= 0.66). Single source of the threshold. */
export function isStrong(strength: number): boolean {
  const tier = tierOf(strength);
  return tier === 'strong' || tier === 'blazing';
}

const COUNT_INDEX = { walk: 1, run: 2, cycle: 3 } as const satisfies Record<ActivityType, 1 | 2 | 3>;

/**
 * Visits of one Turf Cell for the selected activity types: the sum of their counts, as the phone's
 * Turf Map type filter computes them (`GetTurfInViewport`). Default: every type. A cell with 0
 * visits for the selection is not shown; `strengthOf` rejects it, so filter `visits > 0` first.
 */
export function visitsOf(row: TurfCellCounts, types: readonly ActivityType[] = ACTIVITY_TYPES): number {
  return types.reduce((sum, t) => sum + row[COUNT_INDEX[t]], 0);
}
