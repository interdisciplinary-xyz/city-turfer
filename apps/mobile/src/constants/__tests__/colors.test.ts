import { readFileSync } from 'fs';
import { join } from 'path';

import { RAMP, TIER_COLOR } from '../colors';

// The strength ramp lives in @cityturfer/brand (shared with the web app); the turf-preview tool
// inlines the same four colours. Keep them identical.
describe('turf strength ramp', () => {
  it('matches tools/turf-preview.mjs', () => {
    const preview = readFileSync(join(__dirname, '../../../tools/turf-preview.mjs'), 'utf8');
    const line = preview.split('\n').find((l) => l.startsWith('const ramp = '));
    const hexes = (line ?? '').match(/#[0-9a-f]{6}/gi)?.map((h) => h.toUpperCase());
    expect(hexes).toEqual([TIER_COLOR.faint, TIER_COLOR.glowing, TIER_COLOR.strong, TIER_COLOR.blazing]);
  });

  it('RAMP runs faint → glowing → strong → blazing', () => {
    expect(RAMP).toEqual([TIER_COLOR.faint, TIER_COLOR.glowing, TIER_COLOR.strong, TIER_COLOR.blazing]);
  });
});
