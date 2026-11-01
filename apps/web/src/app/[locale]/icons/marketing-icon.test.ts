import { readFileSync } from 'node:fs';
import path from 'node:path';

import { APP_SCHEME, contrastRatio, cssVariables, WEB_SCHEME } from '@cityturfer/brand';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Icon } from './marketing-icon';
import {
  ICON_DISC_TINT,
  ICON_FOR_DIFFER,
  ICON_FOR_GLYPH,
  ICON_FOR_HIGHLIGHT,
  ICON_FOR_TYPE,
  ICON_NAMES,
  ICON_PATHS,
} from './marketing-icon.constants';

// vitest compiles the app's .tsx with the classic JSX runtime (tsconfig keeps `jsx: preserve` for
// Next), so the component looks for a global React at render time.
Object.assign(globalThis, { React });

const HEX = /#[0-9a-f]{3,8}\b/i;
const CSS = readFileSync(path.resolve(import.meta.dirname, 'marketing-icon.css'), 'utf8');
/** Every token a disc draws its icon in (`--icon-color: var(--…)`), read from the stylesheet. */
const DISC_TOKENS = [...CSS.matchAll(/--icon-color:\s*var\((--[\w-]+)\)/g)].map((m) => m[1]);
/** Every token a bare icon is coloured with (`color: var(--…)` outside a disc), read from the stylesheet. */
const BARE_TOKENS = [...CSS.matchAll(/(?<!-)color:\s*var\((--[\w-]+)\)/g)]
  .map((m) => m[1])
  .filter((token) => token !== '--icon-color');
/** The surfaces an icon sits on, on the light page and in night panels. */
const SURFACES = ['--bg', '--card'];
const render = (props: Parameters<typeof Icon>[0]) => renderToStaticMarkup(React.createElement(Icon, props));

/** `color-mix(in srgb, fg p%, transparent)` over `bg`, as the browser composites it. */
function tint(fg: string, bg: string, p: number) {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [f, b] = [rgb(fg), rgb(bg)];
  return `#${f
    .map((v, i) =>
      Math.round(v * p + b[i] * (1 - p))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

describe('marketing icon set', () => {
  it('has path data for every name, and nothing beyond the names', () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual([...ICON_NAMES].sort());
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name].length, name).toBeGreaterThan(0);
      for (const shape of ICON_PATHS[name]) {
        expect(shape.d, name).toMatch(/^M[\d.-]/);
      }
    }
  });

  it('never carries a hex colour: not in the path data, the SVG, or marketing-icon.css', () => {
    for (const name of ICON_NAMES) {
      const svg = render({ name, title: name });
      expect(svg, name).not.toMatch(HEX);
      expect(svg, name).toContain('stroke="currentColor"');
    }
    expect(CSS).not.toMatch(HEX);
    expect(CSS).not.toMatch(/--(faint|glow|strong|blazing)\b/);
    expect(CSS).toContain(`var(--icon-color) ${ICON_DISC_TINT * 100}%, transparent`);
  });

  it('is decorative by default and labelled when given a title', () => {
    expect(render({ name: 'lock' })).toContain('aria-hidden="true"');
    const labelled = render({ name: 'lock', title: 'Private' });
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Private"');
    expect(labelled).toContain('<title>Private</title>');
    expect(labelled).not.toContain('aria-hidden');
    expect(render({ name: 'pin', size: 32 })).toContain('width="32"');
  });

  it('maps every glyph and section key to a real icon', () => {
    for (const map of [ICON_FOR_GLYPH, ICON_FOR_TYPE, ICON_FOR_HIGHLIGHT, ICON_FOR_DIFFER]) {
      for (const icon of Object.values(map)) {
        expect(ICON_NAMES).toContain(icon);
      }
    }
  });

  it('reads its colour tokens from marketing-icon.css: -text on discs, -graphic bare', () => {
    expect(DISC_TOKENS.length).toBeGreaterThanOrEqual(4);
    expect(BARE_TOKENS.length).toBeGreaterThanOrEqual(3);
    for (const token of DISC_TOKENS) {
      expect(token, 'disc icons are drawn in a -text token').toMatch(/-text$/);
    }
    for (const token of BARE_TOKENS) {
      expect(token, 'bare icons are drawn in a -graphic token').toMatch(/-graphic$/);
    }
  });

  it('keeps disc icons at 4:1 or more on their own tint, bare icons at 3:1, on the light page and in night panels', () => {
    for (const scheme of [WEB_SCHEME, APP_SCHEME]) {
      const vars = cssVariables(scheme) as Record<string, string>;
      for (const token of DISC_TOKENS) {
        for (const surface of SURFACES) {
          expect(vars[token], `${scheme} ${token}`).toMatch(/^#[0-9a-f]{6}$/i);
          const disc = tint(vars[token], vars[surface], ICON_DISC_TINT);
          expect(contrastRatio(vars[token], disc), `${scheme} ${token} on ${surface}`).toBeGreaterThanOrEqual(4);
        }
      }
      for (const token of BARE_TOKENS) {
        for (const surface of SURFACES) {
          expect(vars[token], `${scheme} ${token}`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrastRatio(vars[token], vars[surface]), `${scheme} ${token} on ${surface}`).toBeGreaterThanOrEqual(
            3
          );
        }
      }
    }
  });
});
