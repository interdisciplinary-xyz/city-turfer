import { readFileSync } from 'node:fs';
import path from 'node:path';

import { APP_SCHEME, contrastRatio, cssVariables, WEB_SCHEME } from '@cityturfer/brand';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Icon } from '../marketing-icon';
import {
  ICON_DISC_TINT,
  ICON_FOR_DIFFER,
  ICON_FOR_GLYPH,
  ICON_FOR_HIGHLIGHT,
  ICON_FOR_TYPE,
  ICON_NAMES,
  ICON_PATHS,
} from '../marketing-icon.constants';

// vitest compiles the app's .tsx with the classic JSX runtime (tsconfig keeps `jsx: preserve` for
// Next), so the component looks for a global React at render time.
Object.assign(globalThis, { React });

const HEX = /#[0-9a-f]{3,8}\b/i;
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
    const css = readFileSync(path.resolve(import.meta.dirname, '../marketing-icon.css'), 'utf8');
    expect(css).not.toMatch(HEX);
    expect(css).not.toMatch(/--(faint|glow|strong|blazing)\b/);
    expect(css).toContain(`var(--icon-color) ${ICON_DISC_TINT * 100}%, transparent`);
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

  it('keeps disc icons at 3:1 or more on their own tint, on the light page and in night panels', () => {
    for (const scheme of [WEB_SCHEME, APP_SCHEME]) {
      const vars = cssVariables(scheme) as Record<string, string>;
      for (const token of ['--accent-text', '--walk-text', '--run-text', '--ride-text']) {
        for (const surface of ['--bg', '--card']) {
          const disc = tint(vars[token], vars[surface], ICON_DISC_TINT);
          expect(contrastRatio(vars[token], disc), `${scheme} ${token} on ${surface}`).toBeGreaterThanOrEqual(3);
        }
      }
      for (const token of ['--walk-graphic', '--run-graphic', '--ride-graphic']) {
        for (const surface of ['--bg', '--card']) {
          expect(contrastRatio(vars[token], vars[surface]), `${scheme} ${token} on ${surface}`).toBeGreaterThanOrEqual(
            3
          );
        }
      }
    }
  });
});
