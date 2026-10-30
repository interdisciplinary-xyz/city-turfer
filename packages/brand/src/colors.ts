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
/**
 * Text and icons drawn on top of ACCENT in the app (dark). White on glow is 3.5:1, a known AA
 * failure kept so the app does not change; on light surfaces use `LIGHT.onAccent` (night, 5.5:1).
 */
export const ON_ACCENT = '#FFFFFF';

/**
 * The label on an ACCENT fill on the web (website, portal, Swagger, Storybook chrome) in both schemes:
 * night ink, 5.5:1 (AA). The app still draws ON_ACCENT (white, 3.5:1) until its contrast fix, so
 * `cssVariables()` uses this while `DARK.onAccent` stays pinned.
 */
export const WEB_ON_ACCENT = ON_LIGHT;

/**
 * A theme's semantic colours. Both themes carry every key, so `THEMES[scheme].x` always works.
 * Keys beyond the six base roles exist because the brand fills are tuned for night and fail on
 * white: the light theme gives each its own AA variant, the dark theme repeats the brand fill
 * (`docs/decisions/brand-light-theme-2026-10-22.md`).
 */
export type Palette = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  /** Pink as text and links (≥ 4.5:1 on bg and card). The fill stays ACCENT in both themes. */
  accentText: string;
  /** Label on an ACCENT fill (pink buttons, the glow tier chip). */
  onAccent: string;
  /** Edges of inputs and buttons (≥ 3:1 on bg and card). `border` stays for hairlines and dividers. */
  borderControl: string;
  /** The strong tier as text (≥ 4.5:1). */
  strongText: string;
  /** Activity colours as text: labels, numbers, links (≥ 4.5:1). */
  walkText: string;
  runText: string;
  cycleText: string;
  /** Activity colours as lines, icons and dots (≥ 3:1). */
  walkGraphic: string;
  runGraphic: string;
  cycleGraphic: string;
};

/** The light theme: the website and portal (`WEB_SCHEME`, `HEADER_SCHEME`) and the admin's light mode (`docs/decisions/brand-light-website-2026-10-29.md`). */
export const LIGHT: Palette = {
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#0E1116',
  muted: '#5A6375',
  border: '#E3E6EE',
  danger: '#C92A33',
  accentText: '#C2127F',
  onAccent: ON_LIGHT,
  borderControl: '#848DA0',
  strongText: '#9A5B00',
  walkText: '#0F7A4F',
  runText: '#B84E0A',
  cycleText: '#0B6FA8',
  walkGraphic: '#169E63',
  runGraphic: '#E0661A',
  cycleGraphic: '#1C8FD6',
};

/**
 * The app (always dark, read at runtime, so also over OTA), every map panel, the night panels on
 * the website (`APP_SCHEME`), Swagger and Storybook (`SITE_SCHEME`). Pinned in
 * tokens.test.ts: a change here changes the app. The added keys repeat existing dark values.
 */
export const DARK: Palette = {
  bg: '#0B0D12',
  card: '#151924',
  text: '#EEF1F7',
  muted: '#D6DAE3',
  border: '#242A38',
  danger: '#FF6369',
  accentText: ACCENT,
  onAccent: ON_ACCENT,
  borderControl: '#9AA3B5',
  strongText: TIER_COLOR.strong,
  walkText: TYPE_COLOR.walk,
  runText: TYPE_COLOR.run,
  cycleText: TYPE_COLOR.cycle,
  walkGraphic: TYPE_COLOR.walk,
  runGraphic: TYPE_COLOR.run,
  cycleGraphic: TYPE_COLOR.cycle,
};
