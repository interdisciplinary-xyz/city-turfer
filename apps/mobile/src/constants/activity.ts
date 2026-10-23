import type { ActivityTypeName } from '@cityturfer/core/constants';

// The activity types themselves are a core rule (@cityturfer/core); glyphs and symbols are UI. Their
// names are copy: `activityType.<type>` in the `common` namespace (mobile-i18n skill).
export { ACTIVITY_TYPES, type ActivityTypeName } from '@cityturfer/core/constants';

/** Text glyphs: the Android fallback for the SF Symbols below (Android has no SF Symbols). */
export const TYPE_GLYPH: Record<ActivityTypeName, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };
/** SF Symbol names (iOS), drawn by `ActivitySymbol` in ui-kit; plain strings so this file imports nothing. */
export const TYPE_SYMBOL: Record<ActivityTypeName, string> = {
  walk: 'figure.walk',
  run: 'figure.run',
  cycle: 'bicycle',
};
