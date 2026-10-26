/**
 * Design tokens beyond colour: spacing, radii, type scale and the light/dark themes, shared by the
 * app (`@cityturfer/ui`, read in TS) and the website (CSS variables from `cssVariables()`).
 * Values come from the screens as they were in v0.4.0, so adopting a token never changes a pixel.
 * Plain values only (`design-system` skill).
 */
import {
  ACCENT,
  DARK,
  LIGHT,
  ON_TYPE_COLOR,
  type Palette,
  RAMP,
  TIER_COLOR,
  TYPE_COLOR,
  WEB_ON_ACCENT,
} from './colors';

/** Spacing scale in points (app) and CSS pixels (web). */
export const SPACE = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/**
 * Corner radii. Role names say who uses them: `chip` (filter chips, legend), `control` (buttons,
 * list rows), `card` (Card), `panel` (website panels); `sm` for small insets, `full` for pills and
 * circles.
 */
export const RADIUS = { sm: 8, chip: 14, control: 16, card: 18, panel: 20, full: 999 } as const;

/** Type sizes. Labels are uppercase; numbers use tabular figures (`brand-system` typography). */
export const FONT_SIZE = { label: 12, caption: 13, unit: 15, body: 16, lead: 18, stat: 26, hero: 52 } as const;

/** Font weights as strings, the form React Native and CSS both accept. */
export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
} as const;

/**
 * Brand typefaces ("Street Plate", docs/decisions/brand-typography-2026-10-22.md): Big Shoulders
 * Display and Barlow (both OFL), cut into static fonts in `packages/brand/fonts/` by
 * `packages/brand/scripts/make-fonts.py`. The names are the PostScript names, which is how iOS,
 * Android (expo-font config plugin) and the website's `@font-face` all address them. The weight is
 * part of the font: never combine these with `fontWeight`, or Android falls back to the system
 * font. In the app, body text and labels stay on the system font; the website sets them in Barlow.
 */
export const FONT_FAMILY = {
  /** Hero and screen titles: Big Shoulders Display Black, always uppercase (`DISPLAY_CASE`). */
  display: 'BigShouldersDisplay-Black',
  /** Big numbers (distance, time, area): Barlow Semi Condensed ExtraBold, always with tabular figures. */
  numeric: 'BarlowSemiCondensed-ExtraBold',
} as const;

/** Display text is set in capitals: the condensed face reads like a street-name plate. */
export const DISPLAY_CASE = 'uppercase' as const;

/** Letter spacing for display text, in points: capitals need a hair of air, never negative tracking. */
export const DISPLAY_TRACKING = 0.4;

/**
 * Website body family: Barlow, self-hosted in four weights (`Barlow-Regular`, `-Medium`,
 * `-SemiBold`, `-Bold` woff2). Web only; the app's body text is the system font.
 */
export const BODY_FONT_FAMILY = 'Barlow';

/**
 * Website tagline face: Barlow Semi Condensed Black Italic, sentence case, for the hero line "Surf
 * your city. Own your streets." and other taglines (social image, /branding). Web only.
 */
export const TAGLINE_FONT_FAMILY = 'BarlowSemiCondensed-BlackItalic';

/** System font stack the website falls back to (and the app uses for body text). */
export const SYSTEM_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Letter spacing for uppercase labels, in points. */
export const LABEL_TRACKING = 0.8;

/** Turf strength tiers from weakest to strongest: the order of the Ramp and of a legend. */
export const TIER_ORDER = ['faint', 'glowing', 'strong', 'blazing'] as const;
export type TierName = (typeof TIER_ORDER)[number];

export type ColorScheme = 'light' | 'dark';
export const THEMES: Record<ColorScheme, Palette> = { light: LIGHT, dark: DARK };

/**
 * The one place that says which theme the website, Swagger and Storybook use: dark, the app's
 * palette (the app is the source of truth), with no theme switch.
 * `docs/decisions/brand-dark-site-2026-10-25.md` (replaces the light theme of 2026-10-22).
 */
export const SITE_SCHEME: ColorScheme = 'dark';

/** A CSS custom property name and its value. */
export type CssVariables = Record<`--${string}`, string>;

function scale(prefix: string, values: Record<string, number>, unit: string): CssVariables {
  const out: CssVariables = {};
  for (const [key, value] of Object.entries(values)) {
    out[`--${prefix}-${key}`] = `${value}${unit}`;
  }
  return out;
}

/**
 * Every token as CSS custom properties for one colour scheme. The website sets these on `<html>`,
 * so its CSS never hard-codes a brand hex. Brand colours keep their brand names (`--glow`,
 * `--strong`, `--walk`, `--ride`…) and are the same in both schemes; theme colours are semantic
 * (`--bg`, `--card`, `--text`…, `--accent-text`, `--walk-text`, `--ride-graphic`…). On a light
 * surface draw brand colours through the `-text` / `-graphic` variants, never the raw fill.
 */
export function cssVariables(scheme: ColorScheme): CssVariables {
  const theme = THEMES[scheme];
  return {
    '--bg': theme.bg,
    '--card': theme.card,
    '--text': theme.text,
    '--muted': theme.muted,
    '--border': theme.border,
    '--danger': theme.danger,
    '--accent-text': theme.accentText,
    '--border-control': theme.borderControl,
    '--strong-text': theme.strongText,
    '--walk-text': theme.walkText,
    '--run-text': theme.runText,
    '--ride-text': theme.cycleText,
    '--walk-graphic': theme.walkGraphic,
    '--run-graphic': theme.runGraphic,
    '--ride-graphic': theme.cycleGraphic,
    '--accent': ACCENT,
    '--on-accent': WEB_ON_ACCENT,
    '--faint': TIER_COLOR.faint,
    '--glow': TIER_COLOR.glowing,
    '--on-glow': WEB_ON_ACCENT,
    '--strong': TIER_COLOR.strong,
    '--blazing': TIER_COLOR.blazing,
    '--walk': TYPE_COLOR.walk,
    '--run': TYPE_COLOR.run,
    '--ride': TYPE_COLOR.cycle,
    '--on-type': ON_TYPE_COLOR.walk,
    '--ramp-stops': RAMP.join(', '),
    ...scale('space', SPACE, 'px'),
    ...scale('radius', RADIUS, 'px'),
    ...scale('font', FONT_SIZE, 'px'),
    ...Object.fromEntries(Object.entries(FONT_WEIGHT).map(([key, value]) => [`--font-weight-${key}`, value])),
    '--label-tracking': `${LABEL_TRACKING}px`,
    '--font-family-display': `'${FONT_FAMILY.display}', ${SYSTEM_FONT_STACK}`,
    '--font-family-numeric': `'${FONT_FAMILY.numeric}', ${SYSTEM_FONT_STACK}`,
    '--font-family-body': `'${BODY_FONT_FAMILY}', ${SYSTEM_FONT_STACK}`,
    '--font-family-tagline': `'${TAGLINE_FONT_FAMILY}', ${SYSTEM_FONT_STACK}`,
    '--display-case': DISPLAY_CASE,
    '--display-tracking': `${DISPLAY_TRACKING}px`,
  };
}
