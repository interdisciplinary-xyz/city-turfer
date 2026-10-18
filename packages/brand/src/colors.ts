/**
 * Brand colour tokens. The palette is the turf strength ramp: the app's core mechanic is the brand
 * (`brand-system` skill). Plain values only, so any layer of any app may import them.
 */

/** Activity types the colours are keyed by (same union as the app's ActivityTypeName). */
export type BrandActivityType = 'walk' | 'run' | 'cycle';

export const TYPE_COLOR: Record<BrandActivityType, string> = { walk: '#2BD48B', run: '#FF8A3D', cycle: '#3DB8FF' };

/** Strength tier ramp (matches apps/mobile/tools/turf-preview.mjs). */
export const TIER_COLOR = { faint: '#7B2FF7', glowing: '#F72FA8', strong: '#FFB02E', blazing: '#FFF3C4' } as const;
/** The Ramp in order, bottom-left to top-right: faint → glow → strong → blazing. */
export const RAMP = [TIER_COLOR.faint, TIER_COLOR.glowing, TIER_COLOR.strong, TIER_COLOR.blazing] as const;
/** Dark text drawn on light brand fills (white fails WCAG AA on these: walk ~1.9:1, strong ~1.8:1). */
export const ON_LIGHT = '#0B0D12';
/** Text and icons drawn on top of each activity colour. All three are light fills, so all use dark text. */
export const ON_TYPE_COLOR: Record<BrandActivityType, string> = { walk: ON_LIGHT, run: ON_LIGHT, cycle: ON_LIGHT };
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
