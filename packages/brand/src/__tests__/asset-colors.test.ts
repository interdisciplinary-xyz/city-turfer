import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DARK, LIGHT, ON_LIGHT, TIER_COLOR, TYPE_COLOR } from '../colors';

/**
 * The SVG logos and the HTML templates can't import tokens, so they carry hex values. This keeps
 * them honest: every colour must be a brand token or one of the few art-only shades listed here.
 */
const ART_ONLY = new Set([
  '#1B2030', // icon background, radial highlight
  '#2A3145', // city grid inside the mark
  '#2A1238', // purple haze behind phones in store and social images
  '#FFFFFF',
  '#000000',
]);
const TOKENS = new Set(
  [
    ...Object.values(TIER_COLOR),
    ...Object.values(TYPE_COLOR),
    ...Object.values(LIGHT),
    ...Object.values(DARK),
    ON_LIGHT,
  ].map((hex) => hex.toUpperCase())
);

const ROOT = join(__dirname, '..', '..');
const files = ['svg', 'templates'].flatMap((dir) => readdirSync(join(ROOT, dir)).map((name) => join(dir, name)));

describe('colours in brand assets', () => {
  it('finds the assets', () => {
    expect(files).toEqual(
      expect.arrayContaining(['svg/mark.svg', 'svg/wordmark-light.svg', 'templates/og-image.html'])
    );
  });

  it.each(files)('%s uses only brand tokens', (file) => {
    const hexes = readFileSync(join(ROOT, file), 'utf8').match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    const strays = [...new Set(hexes.map((h) => h.toUpperCase()))].filter((h) => !TOKENS.has(h) && !ART_ONLY.has(h));
    expect(strays).toEqual([]);
  });
});
