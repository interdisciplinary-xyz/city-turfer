// Node check: tools/lib/turf.mjs (used by turf-preview.mjs) must match the pinned vectors,
// the same file packages/core/src/contexts/territory/domain/__tests__/territory.test.ts asserts against.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isStrong, strengthOf, tierOf } from '../lib/turf.mjs';

const vectors = JSON.parse(readFileSync(new URL('../fixtures/turf-vectors.json', import.meta.url), 'utf8'));

test('strength vectors', () => {
  for (const v of vectors.strengthVectors) {
    const s = strengthOf(v.visits, v.k);
    assert.ok(Math.abs(s - v.strength) < 5e-7, `${v.visits} visits k=${v.k}: ${s} vs ${v.strength}`);
    assert.equal(tierOf(s), v.tier);
    assert.equal(isStrong(s), v.strong);
  }
});

test('tier boundary vectors', () => {
  for (const v of vectors.tierBoundaryVectors) {
    assert.equal(tierOf(v.strength), v.tier, `strength ${v.strength}`);
    assert.equal(isStrong(v.strength), v.strong, `strength ${v.strength}`);
  }
});
