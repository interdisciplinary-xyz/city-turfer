import { useColorScheme } from 'react-native';

import type { ActivityType } from '@/shared-kernel';

export const TYPE_COLOR: Record<ActivityType, string> = { walk: '#2BD48B', run: '#FF8A3D', cycle: '#3DB8FF' };
export const TYPE_LABEL: Record<ActivityType, string> = { walk: 'Walk', run: 'Run', cycle: 'Ride' };
export const TYPE_GLYPH: Record<ActivityType, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };

/** Strength tier ramp (matches tools/turf-preview.mjs). */
export const TIER_COLOR = { faint: '#7B2FF7', glowing: '#F72FA8', strong: '#FFB02E', blazing: '#FFF3C4' } as const;
export const ACCENT = '#F72FA8';

export const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

const light = {
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#0E1116',
  muted: '#5C6577',
  border: '#E3E6EE',
  danger: '#E5484D',
};
const dark = {
  bg: '#0B0D12',
  card: '#151924',
  text: '#EEF1F7',
  muted: '#9AA3B5',
  border: '#242A38',
  danger: '#FF6369',
};
export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
export const DARK = dark;
