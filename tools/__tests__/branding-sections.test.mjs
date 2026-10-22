import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const DIR = path.resolve(import.meta.dirname, '../../apps/web/src/app/branding');

async function sectionNavIds() {
  const source = await readFile(path.join(DIR, 'page.constants.ts'), 'utf8');
  const block = source.match(/export const SECTIONS[^=]*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(block, 'SECTIONS array not found in page.constants.ts');
  return [...block[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
}

test('SECTIONS ids are unique', async () => {
  const ids = await sectionNavIds();
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
});

test('every SECTIONS id is a <Section id> in page.dev.tsx, and the other way round', async () => {
  const ids = await sectionNavIds();
  const page = await readFile(path.join(DIR, 'page.dev.tsx'), 'utf8');
  const rendered = [...page.matchAll(/<Section\s+id=['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual([...rendered].sort(), [...ids].sort());
});
