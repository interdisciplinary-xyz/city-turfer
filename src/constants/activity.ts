/** Activity types — exactly these three (ubiquitous language); per-type tuning lives in TrackingProfile. */
export const ACTIVITY_TYPES = ['walk', 'run', 'cycle'] as const;
export type ActivityTypeName = (typeof ACTIVITY_TYPES)[number];

export const TYPE_LABEL: Record<ActivityTypeName, string> = { walk: 'Walk', run: 'Run', cycle: 'Ride' };
export const TYPE_GLYPH: Record<ActivityTypeName, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };
