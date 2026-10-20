import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { loadBrand, swaggerThemeCss } from '../../apps/web/tools/swagger-brand.mjs';
import { swaggerHtml, swaggerTarget, withSwagger } from '../../apps/web/tools/swagger-route.mjs';
import { isLocalClient } from '../../packages/dev-toolbar/src/node/index.js';

const WEB = path.resolve(import.meta.dirname, '../../apps/web');
const TOOLS = path.join(WEB, 'tools');
const HEX = /#[0-9a-fA-F]{3,8}\b/;

test('the theme stylesheet is the brand dark variables plus a skin that only uses them', async () => {
  const { cssVariables } = await loadBrand(WEB);
  const vars = cssVariables('dark');
  const css = await swaggerThemeCss(WEB);
  for (const [name, value] of Object.entries(vars)) {
    assert.ok(css.includes(`${name}: ${value};`), `${name} missing from the root variables`);
  }
  const skin = await readFile(path.join(TOOLS, 'swagger-theme.css'), 'utf8');
  const used = [...skin.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  const own = new Set([...skin.matchAll(/^\s*(--ct-[\w-]+):/gm)].map((m) => m[1]));
  for (const name of used) {
    assert.ok(name in vars || own.has(name), `${name} is neither a brand variable nor defined in the skin`);
  }
});

test('no colour literals in the swagger route, theme, brand loader or toolbar files', async () => {
  const files = [
    'swagger-route.mjs',
    'swagger-theme.css',
    'swagger-brand.mjs',
    'swagger-toolbar.mjs',
    'swagger-toolbar-entry.mjs',
  ];
  for (const file of files) {
    assert.doesNotMatch(await readFile(path.join(TOOLS, file), 'utf8'), HEX, `${file} has a hex colour`);
  }
});

test('the page has the CityTurfer header, tab icon and the theme, but no toolbar by default', () => {
  const html = swaggerHtml();
  assert.match(html, /<title>CityTurfer API<\/title>/);
  assert.match(html, /rel="icon"[^>]*brand\/mark\.svg/);
  assert.match(html, /brand\/wordmark\.svg/);
  assert.match(html, /ct-theme\.css/);
  assert.doesNotMatch(html, /toolbar/);
});

test('the page carries the dev toolbar only when asked', () => {
  const html = swaggerHtml({ toolbar: true });
  assert.match(html, /__toolbar\.css/);
  assert.match(html, /id="dev-toolbar-root"/);
  assert.match(html, /__toolbar\.js/);
});

test('only the two logos are served as brand files', () => {
  assert.deepEqual(swaggerTarget('/d', '/swagger/brand/mark.svg'), { kind: 'brand', name: 'mark.svg' });
  assert.deepEqual(swaggerTarget('/d', '/swagger/brand/wordmark.svg'), { kind: 'brand', name: 'wordmark.svg' });
  assert.equal(swaggerTarget('/d', '/swagger/brand/../secret'), null);
  assert.equal(swaggerTarget('/d', '/swagger/brand/other.svg'), null);
});

test('isLocalClient is exported by the toolbar package and reads the last forwarded hop', () => {
  const req = (remote, forwarded) => ({ socket: { remoteAddress: remote }, headers: { 'x-forwarded-for': forwarded } });
  assert.equal(isLocalClient(req('127.0.0.1', undefined)), true);
  assert.equal(isLocalClient(req('127.0.0.1', '10.0.0.7')), false);
  assert.equal(isLocalClient(req('127.0.0.1', '10.0.0.7, 127.0.0.1')), true);
  assert.equal(isLocalClient(req('192.168.1.20', undefined)), false);
});

let dir;
let server;
let url;

const listen = (s) =>
  new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${s.address().port}`)));

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'swagger-brand-'));
  await writeFile(path.join(dir, 'mark.svg'), '<svg id="mark"/>');
  const handler = withSwagger((_req, res) => res.end('next'), {
    distRoot: dir,
    specFile: path.join(dir, 'openapi.json'),
    brandDir: dir,
    // Local only when the request says so (the real server passes isLocalClient).
    isLocal: (req) => req.headers['x-test-local'] === '1',
    loadTheme: async () => ':root{}',
    loadToolbar: async () => ({ js: 'window.toolbar=1', css: '.toolbar{}' }),
  });
  server = createServer(handler);
  url = await listen(server);
});

after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

const LOCAL = { headers: { 'x-test-local': '1' } };

test('injects the toolbar for requests from this machine only', async () => {
  const local = await (await fetch(`${url}/swagger/`, LOCAL)).text();
  assert.match(local, /id="dev-toolbar-root"/);
  assert.match(local, /__toolbar\.js/);

  const remote = await (await fetch(`${url}/swagger/`)).text();
  assert.doesNotMatch(remote, /toolbar/);
});

test('serves the toolbar bundle only to this machine', async () => {
  const js = await fetch(`${url}/swagger/__toolbar.js`, LOCAL);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.equal(await js.text(), 'window.toolbar=1');
  const css = await fetch(`${url}/swagger/__toolbar.css`, LOCAL);
  assert.match(css.headers.get('content-type'), /text\/css/);

  assert.equal((await fetch(`${url}/swagger/__toolbar.js`)).status, 404);
  assert.equal((await fetch(`${url}/swagger/__toolbar.css`)).status, 404);
});

test('serves the theme and the logos', async () => {
  const theme = await fetch(`${url}/swagger/ct-theme.css`);
  assert.match(theme.headers.get('content-type'), /text\/css/);
  assert.equal(await theme.text(), ':root{}');

  const mark = await fetch(`${url}/swagger/brand/mark.svg`);
  assert.equal(mark.headers.get('content-type'), 'image/svg+xml');
  assert.equal(await mark.text(), '<svg id="mark"/>');
  assert.equal((await fetch(`${url}/swagger/brand/wordmark.svg`)).status, 404);
});
