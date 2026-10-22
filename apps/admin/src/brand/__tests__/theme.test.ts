import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { ACCENT, cssVariables, DARK, LIGHT } from '@cityturfer/brand';
import { describe, expect, it } from 'vitest';

import { brandThemeCss } from '../theme';

const css = brandThemeCss({ display: "'Display', sans-serif", body: "'Body'" });

/** The first rule whose selector list contains `selector`, up to its closing brace. */
function block(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('brand theme for Payload', () => {
  it('maps the light and dark brand palettes onto Payload theme variables', () => {
    expect(css).toContain(`--theme-bg: ${LIGHT.bg};`);
    expect(css).toContain(`--theme-bg: ${DARK.bg};`);
    expect(css).toContain(`--theme-text: ${LIGHT.text};`);
    expect(css).toContain(`--theme-error-500: ${DARK.danger};`);
    expect(css).toContain(`--ct-accent: ${ACCENT};`);
    expect(css).toContain(`--font-body: 'Body', ${cssVariables('light')['--font-family-body']};`);
    expect(css).not.toMatch(/undefined|: ;/);
  });

  it('keeps cards, stripes and muted text readable in light mode (AA), and leaves dark to Payload', () => {
    const light = block('html:not([data-theme="dark"]) {');
    // Cards and odd table rows (elevation-50) are the brand card on the brand page (elevation-0).
    expect(light).toContain(`--theme-elevation-0: ${LIGHT.bg};`);
    expect(light).toContain(`--theme-elevation-50: ${LIGHT.card};`);
    expect(light).toContain(`--theme-bg: ${LIGHT.bg};`);
    expect(light).toContain(`--theme-elevation-400: ${LIGHT.muted};`);
    expect(light).toContain(`--theme-elevation-500: ${LIGHT.muted};`);
    expect(block('html[data-theme="dark"] {')).not.toContain('--theme-elevation-');
  });

  it('never applies light-only variables in dark mode (unlayered :root would beat Payload’s dark)', () => {
    // Every rule that sets a grey-ramp variable must exclude dark mode in its selector.
    for (const m of css.matchAll(/([^{}]+)\{[^}]*--theme-elevation-(0|50|400|500):/g)) {
      expect(m[1], m[1]).toContain(':not([data-theme="dark"])');
    }
    expect(css).not.toMatch(/(^|\n):root[^{]*\{[^}]*--theme-elevation-/);
  });

  it('draws form-control edges in the brand control colour (3:1), not the hairline', () => {
    expect(css).toContain(`--ct-border-control: ${LIGHT.borderControl};`);
    expect(css).toContain(`--ct-border-control: ${DARK.borderControl};`);
    expect(block('.field-type input')).toContain('--theme-elevation-150: var(--ct-border-control);');
  });

  it("styles the primary button through Payload's variables, so hover and disabled still work", () => {
    const button = block('.btn--style-primary:not(.btn--disabled)');
    expect(button).toContain('--bg-color: var(--ct-accent);');
    expect(button).toContain('--hover-bg:');
    // An unlayered background-color would beat Payload's layered :hover and disabled rules.
    expect(css).not.toMatch(/\.btn[^{]*\{[^}]*background-color/);
    // Dark label on pink in both modes (AA); white on pink is 3.5:1.
    expect(css.split(`--ct-on-accent: ${LIGHT.onAccent};`).length - 1).toBe(2);
  });

  it('sets page and section titles in the display face, in capitals and tracked; h3 stays body', () => {
    const headings = block('h1, h2');
    expect(headings).toContain("font-family: 'Display', sans-serif;");
    expect(headings).toContain(`text-transform: ${cssVariables('light')['--display-case']};`);
    expect(headings).toContain(`letter-spacing: ${cssVariables('light')['--display-tracking']};`);
    expect(css).not.toMatch(/h3[^{]*\{/);
  });

  it('keeps colour literals out of apps/admin source: colours come from @cityturfer/brand', () => {
    const src = path.resolve(__dirname, '../..');
    const self = path.resolve(__filename);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|scss|css)$/.test(name) && full !== self && !full.includes('migrations')) {
          files.push(full);
        }
      }
    };
    walk(src);
    for (const f of files) {
      // "PR #139"-style references in comments are not colours.
      const text = readFileSync(f, 'utf8').replace(/\bPR #\d+/g, 'PR');
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    }
  });
});
