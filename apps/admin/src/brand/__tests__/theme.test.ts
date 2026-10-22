import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { ACCENT, cssVariables, DARK, LIGHT } from '@cityturfer/brand';
import { describe, expect, it } from 'vitest';

import { brandThemeCss } from '../theme';

const css = brandThemeCss({ display: "'Display', sans-serif", body: "'Body'" });

describe('brand theme for Payload', () => {
  it('maps the light and dark brand palettes onto Payload theme variables', () => {
    expect(css).toContain(`--theme-bg: ${LIGHT.bg};`);
    expect(css).toContain(`--theme-bg: ${DARK.bg};`);
    expect(css).toContain(`--theme-text: ${LIGHT.text};`);
    expect(css).toContain(`--theme-error-500: ${DARK.danger};`);
    expect(css).toContain(`--ct-accent: ${ACCENT};`);
    expect(css).toContain(`--font-body: 'Body', ${cssVariables('light')['--font-family-body']};`);
    expect(css).not.toMatch(/undefined|: ;/);
    // AA label on the pink button in both modes.
    expect(css).not.toContain(`--ct-on-accent: ${DARK.onAccent};`);
    expect(css.split(`--ct-on-accent: ${LIGHT.onAccent};`).length - 1).toBe(2);
  });

  it('uses the brand display face for headings', () => {
    expect(css).toContain("font-family: 'Display', sans-serif;");
  });

  it('keeps brand hex out of apps/admin source: colours come from @cityturfer/brand', () => {
    const src = path.resolve(__dirname, '../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|scss|css)$/.test(name) && !full.includes('__tests__') && !full.includes('migrations')) {
          files.push(full);
        }
      }
    };
    walk(src);
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });
});
