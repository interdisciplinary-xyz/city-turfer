import type { ActivityTypeName } from './activity';

export const TYPE_COLOR: Record<ActivityTypeName, string> = { walk: '#2BD48B', run: '#FF8A3D', cycle: '#3DB8FF' };

/** Strength tier ramp (matches tools/turf-preview.mjs). */
export const TIER_COLOR = { faint: '#7B2FF7', glowing: '#F72FA8', strong: '#FFB02E', blazing: '#FFF3C4' } as const;
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
