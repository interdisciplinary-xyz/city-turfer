import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { EXPORT_EXCLUDED_ROUTES, isExcludedEntry, pruneLocalOnly } from '../../apps/web/tools/prune-local-only.mjs';

test('matches the page, its text/html files and its segment files, nothing else', () => {
  for (const entry of ['branding', 'branding.html', 'branding.txt', '__next.branding.__PAGE__.txt']) {
    assert.equal(isExcludedEntry(entry), true, entry);
  }
  for (const entry of ['en', 'en.html', 'brandingx', 'index.html', '__next.__PAGE__.txt']) {
    assert.equal(isExcludedEntry(entry), false, entry);
  }
});

test('removes the excluded routes from an export folder and keeps the rest', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ct-out-'));
  try {
    await mkdir(path.join(dir, 'branding'));
    await writeFile(path.join(dir, 'branding', 'x.txt'), '');
    for (const f of ['branding.html', 'branding.txt', 'en.html', 'sitemap.xml']) {
      await writeFile(path.join(dir, f), '');
    }
    const removed = await pruneLocalOnly(dir);
    assert.deepEqual(removed, ['branding', 'branding.html', 'branding.txt']);
    assert.deepEqual((await readdir(dir)).sort(), ['en.html', 'sitemap.xml']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the export never contains an excluded route (runs after a web build)', async (t) => {
  const out = path.resolve(import.meta.dirname, '../../apps/web/out');
  let entries;
  try {
    entries = await readdir(out);
  } catch {
    t.skip('apps/web/out does not exist; run pnpm --filter @cityturfer/web build');
    return;
  }
  const leaked = entries.filter((e) => isExcludedEntry(e, EXPORT_EXCLUDED_ROUTES));
  assert.deepEqual(leaked, []);
});
