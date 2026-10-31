// The street-glow demo's generator: tiers per step come from core's own strength formula, and the
// committed data stays within the page-weight budget (docs/plans/homepage-sections-2026-10-28.md).
// Runs under tsx (`tsx --test`, see test:unit): core is TypeScript source; the other tools tests run under node.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { evaluateAchievements } from '@cityturfer/core/achievements';
import { strengthOf, tierOf } from '@cityturfer/core/territory';

import { buildTurfDemo, renderDataFile } from '../gen-turf-demo.mjs';

const demo = buildTurfDemo();

test('visits per tier: 1, 2, 4 and 7, and each is the fewest that reaches its tier', () => {
  assert.deepEqual(demo.visitsPerTier, { faint: 1, glowing: 2, strong: 4, blazing: 7 });
  for (const [tier, visits] of Object.entries(demo.visitsPerTier)) {
    assert.equal(tierOf(strengthOf(visits)), tier);
    if (visits > 1) {
      assert.notEqual(tierOf(strengthOf(visits - 1)), tier);
    }
  }
});

test('the achievement count is the app list', () => {
  assert.equal(demo.achievements, evaluateAchievements({ activities: [], turfCells: 0, strongCells: 0 }).length);
});

test('the data fits the budget: 30 KB gzipped', () => {
  const gzipped = gzipSync(renderDataFile(demo)).length;
  assert.ok(gzipped <= 30 * 1024, `${gzipped} bytes gzipped`);
});
