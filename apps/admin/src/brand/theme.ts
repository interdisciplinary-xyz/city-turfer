import { type ColorScheme, cssVariables, THEMES } from '@cityturfer/brand';

/** Payload's admin sets `data-theme` on <html>: light by default, dark when the staff member picks it. */
const SELECTOR: Record<ColorScheme, string> = {
  light: ':root, html[data-theme="light"]',
  dark: 'html[data-theme="dark"]',
};

/**
 * Brand tokens mapped onto the theme variables of Payload's admin UI. Only the roles both systems
 * share: page, input and text colours, hairlines, danger, body font and control radii; the primary
 * button gets the brand pink. Payload's grey elevation ramp stays its own. Every value comes from
 * `@cityturfer/brand`, never a hex here. Payload's styles sit in `@layer payload-default`, so these
 * unlayered rules win without `!important`.
 */
export function brandThemeCss(fonts: { display: string; body: string }): string {
  const rules = (Object.keys(SELECTOR) as ColorScheme[]).map((scheme) => {
    const v = cssVariables(scheme);
    const vars = {
      '--theme-bg': v['--bg'],
      '--theme-input-bg': v['--card'],
      '--theme-text': v['--text'],
      '--theme-border-color': v['--border'],
      '--theme-error-500': v['--danger'],
      '--ct-accent': v['--accent'],
      // Dark label on the pink fill in both modes: white on pink is 3.5:1 (brand colors.ts, ON_ACCENT).
      '--ct-on-accent': THEMES.light.onAccent,
      '--ct-accent-text': v['--accent-text'],
    };
    const body = Object.entries(vars)
      .map(([k, value]) => `  ${k}: ${value};`)
      .join('\n');
    return `${SELECTOR[scheme]} {\n${body}\n}`;
  });
  const shared = cssVariables('light');
  return [
    ...rules,
    `:root {\n  --font-body: ${fonts.body}, ${shared['--font-family-body']};\n  --style-radius-s: ${shared['--radius-sm']};\n  --style-radius-m: ${shared['--radius-control']};\n  --style-radius-l: ${shared['--radius-card']};\n}`,
    // Headings in the brand display face (its weight is part of the font: no synthesis).
    `h1, h2, h3 {\n  font-family: ${fonts.display};\n  font-weight: normal;\n  font-synthesis: none;\n}`,
    `.btn--style-primary {\n  background-color: var(--ct-accent);\n  color: var(--ct-on-accent);\n}`,
    // Forgot-password is refused (src/collections/staff/hooks.ts): no link to a form that can't work.
    `.login__form a[href$="/forgot"] { display: none; }`,
    `.ct-logo--dark { display: none; }\nhtml[data-theme="dark"] .ct-logo--light { display: none; }\nhtml[data-theme="dark"] .ct-logo--dark { display: block; }`,
  ].join('\n\n');
}
