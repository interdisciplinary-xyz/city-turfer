import type { ActivityTypeName } from '@cityturfer/core/constants';

// The activity types themselves are a core rule (@cityturfer/core); labels and glyphs are UI.
export { ACTIVITY_TYPES, type ActivityTypeName } from '@cityturfer/core/constants';

export const TYPE_LABEL: Record<ActivityTypeName, string> = { walk: 'Walk', run: 'Run', cycle: 'Ride' };
/** Text glyphs: the Android fallback for the SF Symbols below (Android has no SF Symbols). */
export const TYPE_GLYPH: Record<ActivityTypeName, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };
/** SF Symbol names (iOS), drawn by `ActivitySymbol` in ui-kit; plain strings so this file imports nothing. */
export const TYPE_SYMBOL: Record<ActivityTypeName, string> = {
  walk: 'figure.walk',
  run: 'figure.run',
  cycle: 'bicycle',
};
