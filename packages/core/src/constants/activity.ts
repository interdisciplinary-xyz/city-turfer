/** Activity types — exactly these three (ubiquitous language); per-type tuning lives in TrackingProfile. */
export const ACTIVITY_TYPES = ['walk', 'run', 'cycle'] as const;
export type ActivityTypeName = (typeof ACTIVITY_TYPES)[number];
