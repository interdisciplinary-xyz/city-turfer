/** Activity types — exactly these three (ubiquitous language); per-type tuning lives in TrackingProfile. */
export const ACTIVITY_TYPES = ['walk', 'run', 'cycle'] as const;
export type ActivityTypeName = (typeof ACTIVITY_TYPES)[number];

export const TYPE_LABEL: Record<ActivityTypeName, string> = { walk: 'Walk', run: 'Run', cycle: 'Ride' };
/** Text glyphs: the Android fallback for the SF Symbols below (Android has no SF Symbols). */
export const TYPE_GLYPH: Record<ActivityTypeName, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };
/** SF Symbol names (iOS), drawn by `ActivitySymbol` in ui-kit; plain strings so this file imports nothing. */
export const TYPE_SYMBOL: Record<ActivityTypeName, string> = {
  walk: 'figure.walk',
  run: 'figure.run',
  cycle: 'bicycle',
};
