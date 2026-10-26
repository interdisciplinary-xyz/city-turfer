import {
  ACCENT,
  DARK,
  LIGHT,
  ON_ACCENT,
  ON_TIER,
  ON_TYPE_COLOR,
  TIER_COLOR,
  TYPE_COLOR,
  WEB_ON_ACCENT,
} from '../colors';
import { contrastRatio, MIN_CONTRAST } from '../contrast';
import { cssVariables, SITE_SCHEME, TIER_ORDER } from '../tokens';

type Pair = { name: string; fg: string; bg: string; min: number };

const surfaces = [
  ['light bg', LIGHT.bg],
  ['light card', LIGHT.card],
  ['dark bg', DARK.bg],
  ['dark card', DARK.card],
] as const;
const darkSurfaces = surfaces.filter(([name]) => name.startsWith('dark'));

/** What the website, portal, Swagger and Storybook draw with: `cssVariables(SITE_SCHEME)` (dark). */
const WEB = cssVariables(SITE_SCHEME);

/** CSS `color-mix(in srgb, a weight, b)`: a straight mix of the gamma-encoded channels, as #RRGGBB. */
function mixSrgb(a: string, b: string, weight: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ca, cb] = [channels(a), channels(b)];
  return `#${ca
    .map((value, i) => Math.round(value * weight + cb[i] * (1 - weight)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** Every pairing the apps draw, with the minimum it has to meet. */
const PAIRS: Pair[] = [
  // Theme text on its own surfaces.
  ...(['light', 'dark'] as const).flatMap((scheme) => {
    const theme = scheme === 'light' ? LIGHT : DARK;
    return (['bg', 'card'] as const).flatMap((surface) => [
      { name: `${scheme} text on ${surface}`, fg: theme.text, bg: theme[surface], min: MIN_CONTRAST.text },
      { name: `${scheme} muted on ${surface}`, fg: theme.muted, bg: theme[surface], min: MIN_CONTRAST.text },
      { name: `${scheme} danger on ${surface}`, fg: theme.danger, bg: theme[surface], min: MIN_CONTRAST.text },
    ]);
  }),
  // Light-theme variants of the brand colours (the admin's light mode; the web is dark, SITE_SCHEME).
  ...(['bg', 'card'] as const).flatMap((surface) => [
    { name: `light accent-text on ${surface}`, fg: LIGHT.accentText, bg: LIGHT[surface], min: MIN_CONTRAST.text },
    { name: `light strong-text on ${surface}`, fg: LIGHT.strongText, bg: LIGHT[surface], min: MIN_CONTRAST.text },
    { name: `light walk-text on ${surface}`, fg: LIGHT.walkText, bg: LIGHT[surface], min: MIN_CONTRAST.text },
    { name: `light run-text on ${surface}`, fg: LIGHT.runText, bg: LIGHT[surface], min: MIN_CONTRAST.text },
    { name: `light ride-text on ${surface}`, fg: LIGHT.cycleText, bg: LIGHT[surface], min: MIN_CONTRAST.text },
    { name: `light walk-graphic on ${surface}`, fg: LIGHT.walkGraphic, bg: LIGHT[surface], min: MIN_CONTRAST.ui },
    { name: `light run-graphic on ${surface}`, fg: LIGHT.runGraphic, bg: LIGHT[surface], min: MIN_CONTRAST.ui },
    { name: `light ride-graphic on ${surface}`, fg: LIGHT.cycleGraphic, bg: LIGHT[surface], min: MIN_CONTRAST.ui },
    { name: `light border-control on ${surface}`, fg: LIGHT.borderControl, bg: LIGHT[surface], min: MIN_CONTRAST.ui },
  ]),
  // Dark equivalents of the new keys (the app does not read them yet; they must hold if it does).
  ...(['bg', 'card'] as const).map((surface) => ({
    name: `dark border-control on ${surface}`,
    fg: DARK.borderControl,
    bg: DARK[surface],
    min: MIN_CONTRAST.ui,
  })),
  // Labels drawn on brand fills.
  { name: 'on-accent text on accent', fg: ON_ACCENT, bg: ACCENT, min: MIN_CONTRAST.text },
  { name: 'light on-accent text on accent', fg: LIGHT.onAccent, bg: ACCENT, min: MIN_CONTRAST.text },
  { name: 'web on-accent text on accent', fg: WEB_ON_ACCENT, bg: ACCENT, min: MIN_CONTRAST.text },
  { name: 'web on-glow text on glowing', fg: WEB_ON_ACCENT, bg: TIER_COLOR.glowing, min: MIN_CONTRAST.text },
  // The site's own pairs, read from the CSS variables it ships (dark, like the app).
  { name: 'web --on-accent on --accent', fg: WEB['--on-accent'], bg: WEB['--accent'], min: MIN_CONTRAST.text },
  { name: 'web --on-glow on --glow', fg: WEB['--on-glow'], bg: WEB['--glow'], min: MIN_CONTRAST.text },
  { name: 'web --accent-text on --card', fg: WEB['--accent-text'], bg: WEB['--card'], min: MIN_CONTRAST.text }, // 4.95
  { name: 'web glow disc on --card', fg: WEB['--glow'], bg: WEB['--card'], min: MIN_CONTRAST.ui }, // 4.95
  { name: 'web faint legend step on --bg', fg: WEB['--faint'], bg: WEB['--bg'], min: MIN_CONTRAST.ui }, // 3.32
  { name: 'web glow fill on --border', fg: WEB['--glow'], bg: WEB['--border'], min: MIN_CONTRAST.ui }, // 4.05
  // Primary button hover: color-mix(in srgb, var(--glow) 86%, var(--text)) under the night label (≈ 6.06).
  {
    name: 'web --on-accent on the button hover mix',
    fg: WEB['--on-accent'],
    bg: mixSrgb(WEB['--glow'], WEB['--text'], 0.86),
    min: MIN_CONTRAST.text,
  },
  // Destructive buttons (Hold to finish): the accent label on the theme's danger fill.
  ...(['light', 'dark'] as const).map((scheme) => ({
    name: `on-accent text on ${scheme} danger`,
    fg: ON_ACCENT,
    bg: (scheme === 'light' ? LIGHT : DARK).danger,
    min: MIN_CONTRAST.text,
  })),
  ...TIER_ORDER.map((tier) => ({
    name: `on-tier text on ${tier}`,
    fg: ON_TIER[tier],
    bg: TIER_COLOR[tier],
    min: MIN_CONTRAST.text,
  })),
  ...(['walk', 'run', 'cycle'] as const).map((type) => ({
    name: `on-type text on ${type}`,
    fg: ON_TYPE_COLOR[type],
    bg: TYPE_COLOR[type],
    min: MIN_CONTRAST.text,
  })),
  // Accent as a link/selection colour, and brand colours as lines, icons and chips.
  ...surfaces.map(([name, bg]) => ({ name: `accent text on ${name}`, fg: ACCENT, bg, min: MIN_CONTRAST.text })),
  ...surfaces.flatMap(([name, bg]) =>
    (['walk', 'run', 'cycle'] as const).map((type) => ({
      name: `${type} graphic on ${name}`,
      fg: TYPE_COLOR[type],
      bg,
      min: MIN_CONTRAST.ui,
    }))
  ),
  // The Turf Map is always dark; tiers glow on it.
  ...darkSurfaces.flatMap(([name, bg]) =>
    TIER_ORDER.filter((tier) => tier !== 'faint').map((tier) => ({
      name: `${tier} graphic on ${name}`,
      fg: TIER_COLOR[tier],
      bg,
      min: MIN_CONTRAST.ui,
    }))
  ),
];

/**
 * Pairs that fail today, each a brand decision still open (`brand-system` skill, Accessibility).
 * Remove a line once its fix lands: the test fails while a fixed pair is still listed here.
 */
const KNOWN_FAILURES = new Set([
  'on-accent text on accent', // white on glow 3.5:1 in the app; the web draws WEB_ON_ACCENT (night, 5.5:1)
  'on-tier text on glowing', // same pair as the accent
  'on-accent text on dark danger', // 2.9:1: the dark danger is tuned for text on night, not as a fill
  // Raw brand fills on light surfaces: the light theme draws them through LIGHT.accentText,
  // LIGHT.<type>Text and LIGHT.<type>Graphic instead (checked above).
  'accent text on light bg', // 3.3:1
  'accent text on light card', // 3.5:1
  'walk graphic on light bg', // activity colours are tuned for dark maps (1.8–2.4:1 on light)
  'walk graphic on light card',
  'run graphic on light bg',
  'run graphic on light card',
  'cycle graphic on light bg',
  'cycle graphic on light card',
]);

describe('colour contrast (WCAG 2.2)', () => {
  it('computes the reference ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#FFFFFF', '#777777')).toBe(contrastRatio('#777777', '#FFFFFF'));
  });

  it('mixes like color-mix(in srgb)', () => {
    expect(mixSrgb('#FFFFFF', '#000000', 0.5)).toBe('#808080');
    expect(mixSrgb(TIER_COLOR.glowing, DARK.text, 1)).toBe(TIER_COLOR.glowing);
  });

  it('pins the web pairs at their measured ratios', () => {
    const ratio = (fg: string, bg: string) => Math.round(contrastRatio(fg, bg) * 100) / 100;
    expect(ratio(WEB['--accent-text'], WEB['--card'])).toBe(4.95);
    expect(ratio(WEB['--glow'], WEB['--card'])).toBe(4.95);
    expect(ratio(WEB['--faint'], WEB['--bg'])).toBe(3.32);
    expect(ratio(WEB['--glow'], WEB['--border'])).toBe(4.05);
    expect(ratio(WEB['--on-accent'], mixSrgb(WEB['--glow'], WEB['--text'], 0.86))).toBeCloseTo(6.06, 1);
  });

  it('rejects colours that are not #RRGGBB', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow('#RRGGBB');
  });

  it.each(PAIRS.filter((p) => !KNOWN_FAILURES.has(p.name)))('$name meets $min:1', ({ fg, bg, min }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('lists only pairs that exist and still fail', () => {
    const byName = new Map(PAIRS.map((p) => [p.name, p]));
    for (const name of KNOWN_FAILURES) {
      const pair = byName.get(name);
      expect(pair).toBeDefined();
      expect({ name, ratio: contrastRatio(pair!.fg, pair!.bg) < pair!.min }).toEqual({ name, ratio: true });
    }
  });
});
