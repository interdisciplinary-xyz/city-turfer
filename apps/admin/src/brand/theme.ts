import { type ColorScheme, cssVariables, THEMES } from '@cityturfer/brand';

/**
 * Payload's admin sets `data-theme` on <html>: light by default, dark when the staff member picks it.
 * The light block must exclude dark explicitly: these rules are unlayered, so a plain `:root` would
 * beat Payload's own (layered) dark values for every variable the dark block doesn't repeat.
 */
const SELECTOR: Record<ColorScheme, string> = {
  light: 'html:not([data-theme="dark"])',
  dark: 'html[data-theme="dark"]',
};

/** Form controls whose edge Payload draws with `--theme-elevation-150` (or the border colour). */
const CONTROLS = '.field-type input, .field-type textarea, .rs__control, .radio-input__styled-radio';

/** The variables each scheme sets: Payload's names on the left, brand tokens on the right. */
function schemeVariables(scheme: ColorScheme): Record<string, string> {
  const v = cssVariables(scheme);
  const vars: Record<string, string> = {
    '--theme-bg': v['--bg'],
    '--theme-input-bg': v['--card'],
    '--theme-text': v['--text'],
    // Hairlines and dividers. Control edges use `--ct-border-control` (below), at 3:1 or more.
    '--theme-border-color': v['--border'],
    '--theme-error-500': v['--danger'],
    '--ct-accent': v['--accent'],
    // Dark label on the pink fill in both modes: white on pink is 3.5:1 (brand colors.ts, ON_ACCENT).
    '--ct-on-accent': THEMES.light.onAccent,
    '--ct-border-control': v['--border-control'],
  };
  if (scheme === 'light') {
    // The bottom of Payload's grey ramp onto the brand's page/card pair. Payload paints cards and odd
    // table rows with elevation-50 on a page of elevation-0: here the white card on the brand page
    // (1.07:1, as on the website), where Payload's own grey on the brand page would be 1.02:1.
    vars['--theme-elevation-0'] = v['--bg'];
    vars['--theme-elevation-50'] = v['--card'];
    // Payload's secondary text (descriptions, table heads, nav labels, placeholders) and dashed
    // edges: its greys are 2.6:1 and 3.7:1 on the brand page; the brand's muted is 5.6:1.
    vars['--theme-elevation-400'] = v['--muted'];
    vars['--theme-elevation-500'] = v['--muted'];
  }
  // Dark mode: Payload re-ramps its elevation greys itself, and they pass on the brand night.
  return vars;
}

/**
 * Brand tokens mapped onto the theme variables of Payload's admin UI: page, input and text colours,
 * hairlines, danger, the low end of the grey ramp in light mode, muted text, control edges, body
 * font and control radii; the primary button in the brand pink. Every value comes from
 * `@cityturfer/brand`. Payload's styles sit in `@layer payload-default`, so these unlayered rules
 * win without `!important`: that is also why the button sets Payload's own button variables rather
 * than `background-color`, which would override its hover and disabled states.
 */
export function brandThemeCss(fonts: { display: string; body: string }): string {
  const rules = (Object.keys(SELECTOR) as ColorScheme[]).map((scheme) => {
    const body = Object.entries(schemeVariables(scheme))
      .map(([k, value]) => `  ${k}: ${value};`)
      .join('\n');
    return `${SELECTOR[scheme]} {\n${body}\n}`;
  });
  const shared = cssVariables('light');
  return [
    ...rules,
    `:root {\n  --font-body: ${fonts.body}, ${shared['--font-family-body']};\n  --style-radius-s: ${shared['--radius-sm']};\n  --style-radius-m: ${shared['--radius-control']};\n  --style-radius-l: ${shared['--radius-card']};\n}`,
    `${CONTROLS} {\n  --theme-elevation-150: var(--ct-border-control);\n  --theme-border-color: var(--ct-border-control);\n}`,
    // Page and section titles in the brand display face, as the brand sets it: capitals, tracked, the
    // weight in the font. Field-group titles (h3, about 16 px on small screens) stay in Barlow.
    `h1, h2 {\n  font-family: ${fonts.display};\n  font-weight: normal;\n  font-synthesis: none;\n  text-transform: ${shared['--display-case']};\n  letter-spacing: ${shared['--display-tracking']};\n}`,
    // Payload's own button variables, so its hover, focus and disabled rules keep working.
    `.btn--style-primary:not(.btn--disabled) {\n  --bg-color: var(--ct-accent);\n  --color: var(--ct-on-accent);\n  --hover-bg: color-mix(in srgb, var(--ct-accent) 85%, white);\n  --hover-color: var(--ct-on-accent);\n}`,
    // Forgot-password is refused (src/collections/staff/hooks.ts): no link to a form that can't work.
    `.login__form a[href$="/forgot"] { display: none; }`,
    `.ct-logo--dark { display: none; }\nhtml[data-theme="dark"] .ct-logo--light { display: none; }\nhtml[data-theme="dark"] .ct-logo--dark { display: block; }`,
    `.ct-mark { border-radius: 23%; }`,
  ].join('\n\n');
}
