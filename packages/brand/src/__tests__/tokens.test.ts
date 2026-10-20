import { ACCENT, DARK, LIGHT, ON_ACCENT, RAMP, TIER_COLOR, TYPE_COLOR } from '../colors';
import { cssVariables, FONT_SIZE, RADIUS, SPACE, THEMES, TIER_ORDER } from '../tokens';

describe('design tokens', () => {
  it('keep the brand hex values (brand-system skill table)', () => {
    expect(TIER_COLOR).toEqual({ faint: '#7B2FF7', glowing: '#F72FA8', strong: '#FFB02E', blazing: '#FFF3C4' });
    expect(ACCENT).toBe(TIER_COLOR.glowing);
    expect(TYPE_COLOR).toEqual({ walk: '#2BD48B', run: '#FF8A3D', cycle: '#3DB8FF' });
    expect(DARK.bg).toBe('#0B0D12');
    expect(DARK.card).toBe('#151924');
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
      '--on-glow': ON_ACCENT,
      '--ride': TYPE_COLOR.cycle,
      '--space-lg': '16px',
      '--radius-panel': '20px',
      '--font-hero': '52px',
      '--font-weight-medium': '500',
      '--label-tracking': '0.8px',
    });
    expect(cssVariables('dark')['--font-family-display']).toMatch(/^'ArchivoExpanded-Black', -apple-system/);
    expect(cssVariables('dark')['--font-family-numeric']).toMatch(/^'Archivo-ExtraBold', /);
  });

  it('switches only the theme colours between schemes', () => {
    const light: Record<string, string> = cssVariables('light');
    const dark: Record<string, string> = cssVariables('dark');
    const changed = Object.keys(light).filter((k) => light[k] !== dark[k]);
    expect(changed.sort()).toEqual(['--bg', '--border', '--card', '--danger', '--muted', '--text']);
  });

  it('emits only custom properties with non-empty values', () => {
    for (const [name, value] of Object.entries(cssVariables('light'))) {
      expect(name).toMatch(/^--[a-z]+(-[a-z]+)*$/);
      expect(value).not.toBe('');
    }
  });
});
