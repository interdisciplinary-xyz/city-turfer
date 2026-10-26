import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { build } from 'esbuild';

import { contentTypeOf, storybookFile, withAppHeader, withStorybook } from '../../apps/web/tools/storybook-route.mjs';
import { loadBrand } from '../../apps/web/tools/swagger-brand.mjs';

const ROOT = path.resolve('/srv/storybook-static');

test('maps /storybook paths into the build, index.html for the root', () => {
  assert.equal(storybookFile(ROOT, '/storybook'), path.join(ROOT, 'index.html'));
  assert.equal(storybookFile(ROOT, '/storybook/'), path.join(ROOT, 'index.html'));
  assert.equal(storybookFile(ROOT, '/storybook/iframe.html'), path.join(ROOT, 'iframe.html'));
  assert.equal(storybookFile(ROOT, '/storybook/assets/a%20b.js'), path.join(ROOT, 'assets/a b.js'));
});

test('leaves other paths to Next', () => {
  assert.equal(storybookFile(ROOT, '/'), null);
  assert.equal(storybookFile(ROOT, '/en'), null);
  assert.equal(storybookFile(ROOT, '/storybookish'), null);
});

test('refuses paths that leave the build folder', () => {
  assert.equal(storybookFile(ROOT, '/storybook/../secret.txt'), null);
  assert.equal(storybookFile(ROOT, '/storybook/%2e%2e/secret.txt'), null);
  assert.equal(storybookFile(ROOT, '/storybook/%E0%A4%A'), null);
});

test('content types', () => {
  assert.equal(contentTypeOf('a/index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeOf('a/b.JS'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeOf('a/b.unknown'), 'application/octet-stream');
});

let dir;
let server;
let base;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'sb-route-'));
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'index.html'), '<html>storybook</html>');
  await writeFile(path.join(dir, 'assets/app.js'), 'console.log(1)');
  const next = (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('next');
  };
  server = createServer(withStorybook(next, dir));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

test('serves the build, redirects the bare prefix, passes the rest to Next', async () => {
  const redirect = await fetch(`${base}/storybook`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/storybook/');

  const index = await fetch(`${base}/storybook/`);
  assert.equal(index.status, 200);
  assert.equal(await index.text(), '<html>storybook</html>');

  const asset = await fetch(`${base}/storybook/assets/app.js?v=1`);
  assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8');

  const missing = await fetch(`${base}/storybook/nope.js`);
  assert.equal(missing.status, 404);

  const site = await fetch(`${base}/en`);
  assert.equal(await site.text(), 'next');
});

test('says how to build Storybook when the build is missing', async () => {
  const empty = await mkdtemp(path.join(tmpdir(), 'sb-empty-'));
  const s = createServer(withStorybook(() => undefined, empty));
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/storybook/`);
  assert.equal(res.status, 404);
  assert.match(await res.text(), /pnpm -C apps\/storybook run build/);
  await new Promise((resolve) => s.close(resolve));
  await rm(empty, { recursive: true, force: true });
});

test('puts the site header above Storybook, for every request; the toolbar only for this machine', async () => {
  const shell = await mkdtemp(path.join(tmpdir(), 'sb-header-'));
  await writeFile(path.join(shell, 'index.html'), '<html><head></head><body><div id="root"></div></body></html>');
  const s = createServer(
    withStorybook(() => undefined, shell, {
      isLocal: (req) => req.headers['x-test-local'] === '1',
      loadAppHeader: async () => ({ js: 'window.header=1', css: '.app-header{}' }),
      loadToolbar: async () => ({ js: '', css: '' }),
    })
  );
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const at = `http://127.0.0.1:${s.address().port}`;

  const remote = await (await fetch(`${at}/storybook/`)).text();
  assert.match(
    remote,
    /<body><div id="app-header-root"><\/div><script src="\.\/__app-header\.js"><\/script><div id="root">/
  );
  assert.match(remote, /__app-header\.css/);
  assert.doesNotMatch(remote, /toolbar/);
  const local = await (await fetch(`${at}/storybook/`, { headers: { 'x-test-local': '1' } })).text();
  assert.match(local, /app-header-root/);
  assert.match(local, /dev-toolbar-root/);

  const js = await fetch(`${at}/storybook/__app-header.js`);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.equal(await js.text(), 'window.header=1');
  assert.equal(await (await fetch(`${at}/storybook/__app-header.css`)).text(), '.app-header{}');

  await new Promise((resolve) => s.close(resolve));
  await rm(shell, { recursive: true, force: true });
});

test('Storybook UI is pinned below the header', () => {
  const html = withAppHeader('<html><head></head><body class="sb"><div id="root"></div></body></html>');
  assert.match(html, /#root \{ position: fixed; inset: var\(--header-h\) 0 0 0; \}/);
  assert.match(html, /<body class="sb"><div id="app-header-root">/);
});

/**
 * The Storybook theme object as Storybook receives it: theme.ts bundled with esbuild, its
 * `create()` from storybook/theming replaced by the identity, so the test reads the real values.
 */
async function storybookTheme() {
  const { outputFiles } = await build({
    entryPoints: [path.resolve(import.meta.dirname, '../../apps/storybook/.storybook/theme.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    plugins: [
      {
        name: 'theming-stub',
        setup(b) {
          b.onResolve({ filter: /^storybook\/theming$/ }, () => ({ path: 'theming', namespace: 'stub' }));
          b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const create = (t) => t;' }));
        },
      },
    ],
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`;
  return (await import(url)).cityTurferTheme;
}

/** `{ tag, class, style }` of each element in a small HTML fragment (no nesting needed here). */
const elements = (html) =>
  [...html.matchAll(/<(\w+)([^>]*)>/g)].map(([, tag, attrs]) => ({
    tag,
    ...Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
  }));

test('under the site header the sidebar shows a label instead of a second logo', async () => {
  const html = withAppHeader('<html><head></head><body><div id="root"></div></body></html>');
  assert.match(html, /\.ct-sb-logo \{ display: none !important; \}/);
  assert.match(html, /\.ct-sb-label \{ display: inline !important; \}/);
  // The sidebar title Storybook renders: the logo by default, the label hidden until the header shows.
  const theme = await storybookTheme();
  const byClass = Object.fromEntries(elements(theme.brandTitle).map((e) => [e.class, e]));
  assert.ok(byClass['ct-sb-logo'], theme.brandTitle);
  assert.equal(byClass['ct-sb-label']?.style, 'display:none');
  assert.ok(elements(theme.brandTitle).some((e) => e.tag === 'img' && e.alt === 'CityTurfer'));
});

test('the Storybook UI theme uses the site scheme', async () => {
  const theme = await storybookTheme();
  const { SITE_SCHEME, THEMES } = await loadBrand(path.resolve(import.meta.dirname, '../../apps/web'));
  assert.equal(theme.base, SITE_SCHEME);
  assert.equal(theme.appBg, THEMES[SITE_SCHEME].bg);
  assert.equal(theme.textColor, THEMES[SITE_SCHEME].text);
});
