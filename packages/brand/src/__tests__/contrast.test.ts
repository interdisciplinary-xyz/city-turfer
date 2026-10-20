import { ACCENT, DARK, LIGHT, ON_ACCENT, ON_TIER, ON_TYPE_COLOR, TIER_COLOR, TYPE_COLOR } from '../colors';
import { contrastRatio, MIN_CONTRAST } from '../contrast';
import { TIER_ORDER } from '../tokens';

type Pair = { name: string; fg: string; bg: string; min: number };

const surfaces = [
  ['light bg', LIGHT.bg],
  ['light card', LIGHT.card],
  ['dark bg', DARK.bg],
  ['dark card', DARK.card],
] as const;
const darkSurfaces = surfaces.filter(([name]) => name.startsWith('dark'));

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
  // Labels drawn on brand fills.
  { name: 'on-accent text on accent', fg: ON_ACCENT, bg: ACCENT, min: MIN_CONTRAST.text },
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
  'on-accent text on accent', // white on glow 3.5:1: buttons need night text or a deeper accent
  'on-tier text on glowing', // same pair as the accent
  'on-accent text on light danger', // 3.9:1: white label on the danger button
  'on-accent text on dark danger', // 2.9:1: the dark danger is tuned for text on night, not as a fill
  'light danger on bg', // 3.7:1: needs a darker red on light
  'light danger on card', // 3.9:1
  'accent text on light bg', // 3.3:1: links on light need a deeper pink
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
