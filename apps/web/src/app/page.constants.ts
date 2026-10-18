import { ON_TIER, TIER_COLOR } from '@cityturfer/brand';

/** Turf strength tiers, from first visit to many, as shown in step 3. */
export const TIERS = [
  { label: 'Faint', color: TIER_COLOR.faint, text: ON_TIER.faint },
  { label: 'Glowing', color: TIER_COLOR.glowing, text: ON_TIER.glowing },
  { label: 'Strong', color: TIER_COLOR.strong, text: ON_TIER.strong },
  { label: 'Blazing', color: TIER_COLOR.blazing, text: ON_TIER.blazing },
];
