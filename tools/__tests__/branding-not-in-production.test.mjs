import assert from 'node:assert/strict';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

// /branding is internal: a route in development only (`page.dev.tsx` + `pageExtensions` in
// apps/web/next.config.ts). After a production build neither the export nor the route manifest may
// mention it. Skips when there is no build (run `pnpm --filter @cityturfer/web build` first), or
// when the build is older than the source that decides the routes: a stale build proves nothing
// about the current code.
const WEB = path.resolve(import.meta.dirname, '../../apps/web');
const SOURCES = [path.join(WEB, 'next.config.ts'), path.join(WEB, 'src/app')];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Newest modification time under `p` (a file or a folder, walked recursively). */
async function newest(p) {
  const s = await stat(p);
  if (!s.isDirectory()) {
    return s.mtimeMs;
  }
  let max = s.mtimeMs;
  for (const e of await readdir(p)) {
    max = Math.max(max, await newest(path.join(p, e)));
  }
  return max;
}

/** Why the build at `built` cannot be trusted, or null. */
async function staleReason(built) {
  if (!(await exists(built))) {
    return `${path.relative(WEB, built)} does not exist`;
  }
  const builtAt = (await stat(built)).mtimeMs;
  for (const src of SOURCES) {
    if ((await exists(src)) && (await newest(src)) > builtAt) {
      return `${path.relative(WEB, built)} is older than ${path.relative(WEB, src)}; rebuild apps/web`;
    }
  }
  return null;
}

test('the production export has no branding files', async (t) => {
  const out = path.join(WEB, 'out');
  const stale = await staleReason(out);
  if (stale) {
    t.skip(stale);
    return;
  }
  const leaked = (await readdir(out)).filter((e) => /^(__next\.)?branding(\.|$)/.test(e));
  assert.deepEqual(leaked, []);
});

test('the production build registers no /branding route', async (t) => {
  const manifest = path.join(WEB, '.next/app-path-routes-manifest.json');
  const stale = (await staleReason(manifest)) ?? (await staleReason(path.join(WEB, 'out')));
  if (stale) {
    t.skip(stale);
    return;
  }
  const routes = Object.values(JSON.parse(await readFile(manifest, 'utf8')));
  assert.deepEqual(
    routes.filter((r) => r.startsWith('/branding')),
    []
  );
});
