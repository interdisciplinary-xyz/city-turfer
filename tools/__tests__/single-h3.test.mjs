import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// Turf Cells are H3 cells: the phone and the server must compute the same cell ids, so h3-js is
// one exact version, declared once (by @cityturfer/core, behind @cityturfer/core/h3) and installed
// once. A second copy or a range would let a workspace drift to other cell ids
// (docs/decisions/api-2026-10-20.md, "Turf determinism").
const ROOT = join(import.meta.dirname, '..', '..');
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const workspaces = () =>
  ['apps', 'packages'].flatMap((group) => readdirSync(join(ROOT, group)).map((name) => join(group, name)));

test('only @cityturfer/core declares h3-js, pinned to an exact version', () => {
  const declaring = [];
  for (const workspace of workspaces()) {
    const file = join(workspace, 'package.json');
    if (!existsSync(join(ROOT, file))) {
      continue;
    }
    const pkg = readJson(file);
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (pkg[field]?.['h3-js']) {
        declaring.push(`${pkg.name} (${field}: ${pkg[field]['h3-js']})`);
      }
    }
  }
  const core = readJson('packages/core/package.json');
  assert.deepEqual(declaring, [`@cityturfer/core (dependencies: ${core.dependencies['h3-js']})`]);
  assert.match(core.dependencies['h3-js'], /^\d+\.\d+\.\d+$/, 'pin h3-js to an exact version (no ^ or ~)');
});

test('one copy of h3-js is installed, the pinned one', () => {
  const nested = workspaces()
    .map((workspace) => join(workspace, 'node_modules', 'h3-js'))
    .filter((path) => existsSync(join(ROOT, path)));
  assert.deepEqual(nested, [], `nested copies of h3-js: ${nested.join(', ')}`);

  const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');
  const versions = [...new Set([...lock.matchAll(/^ {2}h3-js@([^:(]+)/gm)].map((m) => m[1]))];
  const pinned = readJson('packages/core/package.json').dependencies['h3-js'];
  assert.deepEqual(versions, [pinned], 'the lockfile resolves exactly the pinned h3-js');
  if (existsSync(join(ROOT, 'node_modules/h3-js/package.json'))) {
    assert.equal(readJson('node_modules/h3-js/package.json').version, pinned, 'installed h3-js is the pinned one');
  }
});
