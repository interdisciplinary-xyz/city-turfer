// Reference turf formula. Pinned by tools/fixtures/turf-vectors.json and mirrored by
// src/contexts/territory/domain/strength.ts (both assert against the same vectors).

export const TURF_SATURATION_K = 3;
export const TIER_BOUNDS = { glowing: 0.33, strong: 0.66, blazing: 0.9 };

export const strengthOf = (visits, k = TURF_SATURATION_K) => 1 - Math.exp(-visits / k);

export function tierOf(strength) {
  if (strength < TIER_BOUNDS.glowing) {
    return 'faint';
  }
  if (strength < TIER_BOUNDS.strong) {
    return 'glowing';
  }
  if (strength < TIER_BOUNDS.blazing) {
    return 'strong';
  }
  return 'blazing';
}

/** "Strong" turf = tier strong or blazing (strength >= 0.66). */
export const isStrong = (strength) => strength >= TIER_BOUNDS.strong;
