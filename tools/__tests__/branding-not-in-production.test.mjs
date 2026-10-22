import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

// /branding is internal: a route in development only (`page.dev.tsx` + `pageExtensions` in
// apps/web/next.config.ts). After a production build neither the export nor the route manifest may
// mention it. Skips when there is no build (run `pnpm --filter @cityturfer/web build` first).
const WEB = path.resolve(import.meta.dirname, '../../apps/web');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

test('the production export has no branding files', async (t) => {
  const out = path.join(WEB, 'out');
  if (!(await exists(out))) {
    t.skip('apps/web/out does not exist');
    return;
  }
  const leaked = (await readdir(out)).filter((e) => /^(__next\.)?branding(\.|$)/.test(e));
  assert.deepEqual(leaked, []);
});

test('the production build registers no /branding route', async (t) => {
  const manifest = path.join(WEB, '.next/app-path-routes-manifest.json');
  if (!(await exists(manifest)) || !(await exists(path.join(WEB, 'out')))) {
    t.skip('no production build in apps/web/.next');
    return;
  }
  const { readFile } = await import('node:fs/promises');
  const routes = Object.values(JSON.parse(await readFile(manifest, 'utf8')));
  assert.deepEqual(
    routes.filter((r) => r.startsWith('/branding')),
    []
  );
});
