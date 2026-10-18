import type { ActivityTypeName } from './activity';

export const TYPE_COLOR: Record<ActivityTypeName, string> = { walk: '#2BD48B', run: '#FF8A3D', cycle: '#3DB8FF' };

/** Strength tier ramp (matches tools/turf-preview.mjs). */
export const TIER_COLOR = { faint: '#7B2FF7', glowing: '#F72FA8', strong: '#FFB02E', blazing: '#FFF3C4' } as const;
/** Dark text drawn on light brand fills (white fails WCAG AA on these: walk ~1.9:1, strong ~1.8:1). */
export const ON_LIGHT = '#0B0D12';
/** Text and icons drawn on top of each activity colour. All three are light fills, so all use dark text. */
export const ON_TYPE_COLOR: Record<ActivityTypeName, string> = { walk: ON_LIGHT, run: ON_LIGHT, cycle: ON_LIGHT };
/** Text drawn on top of each strength tier fill. */
export const ON_TIER = { faint: '#FFFFFF', glowing: '#FFFFFF', strong: ON_LIGHT, blazing: ON_LIGHT } as const;
export const ACCENT = '#F72FA8';
/** Text and icons drawn on top of ACCENT. */
export const ON_ACCENT = '#FFFFFF';

export const LIGHT = {
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#0E1116',
  muted: '#5C6577',
  border: '#E3E6EE',
  danger: '#E5484D',
};
export const DARK: typeof LIGHT = {
  bg: '#0B0D12',
  card: '#151924',
  text: '#EEF1F7',
  muted: '#9AA3B5',
  border: '#242A38',
  danger: '#FF6369',
};
