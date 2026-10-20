import type { ActivityTypeName } from '@cityturfer/core/constants';

// The activity types themselves are a core rule (@cityturfer/core); labels and glyphs are UI.
export { ACTIVITY_TYPES, type ActivityTypeName } from '@cityturfer/core/constants';

export const TYPE_LABEL: Record<ActivityTypeName, string> = { walk: 'Walk', run: 'Run', cycle: 'Ride' };
export const TYPE_GLYPH: Record<ActivityTypeName, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };
