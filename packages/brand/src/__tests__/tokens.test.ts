import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ACCENT, DARK, LIGHT, ON_ACCENT, ON_LIGHT, ON_TIER, RAMP, TIER_COLOR, TYPE_COLOR } from '../colors';
import {
  BODY_FONT_FAMILY,
  cssVariables,
  FONT_FAMILY,
  FONT_SIZE,
  RADIUS,
  SITE_SCHEME,
  SPACE,
  TAGLINE_FONT_FAMILY,
  THEMES,
  TIER_ORDER,
} from '../tokens';

/** The colours the app (always dark) reads at runtime: a change here reaches phones over OTA. */
const PINNED_DARK = {
  bg: '#0B0D12',
  card: '#151924',
  text: '#EEF1F7',
  muted: '#9AA3B5',
  border: '#242A38',
  danger: '#FF6369',
};

/** Every CSS variable the dark scheme emitted before the light theme existed, with its v0.9.0 value. */
const PINNED_DARK_CSS = {
  '--bg': '#0B0D12',
  '--card': '#151924',
  '--text': '#EEF1F7',
  '--muted': '#9AA3B5',
  '--border': '#242A38',
  '--danger': '#FF6369',
  '--accent': '#F72FA8',
  // The web's pink label is night ink in both schemes (WEB_ON_ACCENT, AA); the app keeps white.
  '--on-accent': '#0B0D12',
  '--faint': '#7B2FF7',
  '--glow': '#F72FA8',
  '--on-glow': '#0B0D12',
  '--strong': '#FFB02E',
  '--blazing': '#FFF3C4',
  '--walk': '#2BD48B',
  '--run': '#FF8A3D',
  '--ride': '#3DB8FF',
  '--on-type': '#0B0D12',
  '--ramp-stops': '#7B2FF7, #F72FA8, #FFB02E, #FFF3C4',
};

describe('design tokens', () => {
  it('keep the brand hex values (brand-system skill table)', () => {
    expect(TIER_COLOR).toEqual({ faint: '#7B2FF7', glowing: '#F72FA8', strong: '#FFB02E', blazing: '#FFF3C4' });
    expect(ACCENT).toBe(TIER_COLOR.glowing);
    expect(TYPE_COLOR).toEqual({ walk: '#2BD48B', run: '#FF8A3D', cycle: '#3DB8FF' });
    expect(ON_ACCENT).toBe('#FFFFFF');
    expect(ON_TIER).toEqual({ faint: '#FFFFFF', glowing: '#FFFFFF', strong: ON_LIGHT, blazing: ON_LIGHT });
  });

  it('pin the dark theme the app reads (the app stays dark; light is for the website)', () => {
    expect(DARK).toMatchObject(PINNED_DARK);
    // Keys added for the light theme repeat existing dark values, so the app draws exactly what it did.
    expect(DARK).toMatchObject({
      accentText: ACCENT,
      onAccent: ON_ACCENT,
      borderControl: PINNED_DARK.muted,
      strongText: TIER_COLOR.strong,
      walkText: TYPE_COLOR.walk,
      runText: TYPE_COLOR.run,
      cycleText: TYPE_COLOR.cycle,
      walkGraphic: TYPE_COLOR.walk,
      runGraphic: TYPE_COLOR.run,
      cycleGraphic: TYPE_COLOR.cycle,
    });
  });

  it('keep the light theme values (docs/decisions/brand-light-theme-2026-10-22.md)', () => {
    expect(LIGHT).toEqual({
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
    });
  });

  it("put the website, Swagger and Storybook on the app's dark scheme", () => {
    expect(SITE_SCHEME).toBe('dark');
  });

  it('order the tiers like the Ramp', () => {
    expect(TIER_ORDER.map((t) => TIER_COLOR[t])).toEqual([...RAMP]);
  });

  it('expose both themes with the same keys', () => {
    expect(THEMES.light).toBe(LIGHT);
    expect(THEMES.dark).toBe(DARK);
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
  });

  it('keep the scales from the v0.4.0 screens', () => {
    expect(RADIUS.control).toBe(16);
    expect(RADIUS.card).toBe(18);
    expect(SPACE.lg).toBe(16);
    expect(FONT_SIZE).toMatchObject({ label: 12, stat: 26, hero: 52, lead: 18 });
  });
});

describe('cssVariables', () => {
  it('maps the dark theme to the variables the website uses', () => {
    expect(cssVariables('dark')).toMatchObject({
      '--bg': DARK.bg,
      '--card': DARK.card,
      '--text': DARK.text,
      '--glow': TIER_COLOR.glowing,
      '--on-glow': ON_LIGHT,
      '--ride': TYPE_COLOR.cycle,
      '--space-lg': '16px',
      '--radius-panel': '20px',
      '--font-hero': '52px',
      '--font-weight-medium': '500',
      '--label-tracking': '0.8px',
    });
    expect(cssVariables('dark')['--font-family-display']).toMatch(/^'BigShouldersDisplay-Black', -apple-system/);
    expect(cssVariables('dark')['--font-family-numeric']).toMatch(/^'BarlowSemiCondensed-ExtraBold', /);
    expect(cssVariables('dark')['--font-family-body']).toMatch(/^'Barlow', -apple-system/);
    expect(cssVariables('dark')['--font-family-tagline']).toMatch(/^'BarlowSemiCondensed-BlackItalic', /);
    expect(cssVariables('light')).toMatchObject({ '--display-case': 'uppercase', '--display-tracking': '0.4px' });
  });

  it('keeps every dark variable the website and Swagger used before the light theme', () => {
    expect(cssVariables('dark')).toMatchObject(PINNED_DARK_CSS);
  });

  it('emits the light-theme variants', () => {
    expect(cssVariables('light')).toMatchObject({
      '--accent': ACCENT,
      '--accent-text': LIGHT.accentText,
      '--on-accent': ON_LIGHT,
      '--on-glow': ON_LIGHT,
      '--border-control': LIGHT.borderControl,
      '--strong-text': LIGHT.strongText,
      '--walk-text': LIGHT.walkText,
      '--run-text': LIGHT.runText,
      '--ride-text': LIGHT.cycleText,
      '--walk-graphic': LIGHT.walkGraphic,
      '--run-graphic': LIGHT.runGraphic,
      '--ride-graphic': LIGHT.cycleGraphic,
    });
  });

  // The pink label is WEB_ON_ACCENT in both schemes, so it is not among the changed keys.
  it('switches only the theme colours between schemes', () => {
    const light: Record<string, string> = cssVariables('light');
    const dark: Record<string, string> = cssVariables('dark');
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    const changed = Object.keys(light).filter((k) => light[k] !== dark[k]);
    expect(changed.sort()).toEqual(
      [
        '--accent-text',
        '--bg',
        '--border',
        '--border-control',
        '--card',
        '--danger',
        '--muted',
        '--ride-graphic',
        '--ride-text',
        '--run-graphic',
        '--run-text',
        '--strong-text',
        '--text',
        '--walk-graphic',
        '--walk-text',
      ].sort()
    );
  });

  it('emits only custom properties with non-empty values', () => {
    for (const [name, value] of Object.entries(cssVariables('light'))) {
      expect(name).toMatch(/^--[a-z]+(-[a-z]+)*$/);
      expect(value).not.toBe('');
    }
  });
});

describe('brand fonts', () => {
  // The app bundles <name>.ttf (expo-font plugin) and the web loads <name>.woff2, by PostScript name.
  const fonts = join(__dirname, '..', '..', 'fonts');

  it('ships every FONT_FAMILY font for the app and the web', () => {
    for (const name of Object.values(FONT_FAMILY)) {
      expect(existsSync(join(fonts, `${name}.ttf`))).toBe(true);
      expect(existsSync(join(fonts, `${name}.woff2`))).toBe(true);
    }
  });

  it('ships the website tagline face', () => {
    expect(existsSync(join(fonts, `${TAGLINE_FONT_FAMILY}.woff2`))).toBe(true);
  });

  it('ships the four website body weights', () => {
    for (const weight of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      expect(existsSync(join(fonts, `${BODY_FONT_FAMILY}-${weight}.woff2`))).toBe(true);
    }
  });
});
