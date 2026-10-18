import { ON_TIER, TIER_COLOR } from '@/constants/colors';

/** How long the Stop button must be held before the recording finishes. */
export const HOLD_MS = 900;

export const STATUS_BANNER: Record<string, { text: string; color: string; textColor: string }> = {
  acquiring: { text: 'Waiting for GPS…', color: '#5C6577', textColor: '#FFFFFF' },
  paused: { text: 'Paused', color: TIER_COLOR.strong, textColor: ON_TIER.strong },
  autoPaused: { text: 'Auto-paused — start moving to resume', color: TIER_COLOR.faint, textColor: ON_TIER.faint },
};
