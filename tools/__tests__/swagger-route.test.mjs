import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { apiPath, swaggerHtml, swaggerTarget, withSwagger } from '../../apps/web/tools/swagger-route.mjs';

const DIST = path.resolve('/srv/swagger-ui-dist');

test('maps /swagger paths to the page, the spec or a dist asset', () => {
  assert.deepEqual(swaggerTarget(DIST, '/swagger'), { kind: 'page' });
  assert.deepEqual(swaggerTarget(DIST, '/swagger/'), { kind: 'page' });
  assert.deepEqual(swaggerTarget(DIST, '/swagger/openapi.json'), { kind: 'spec' });
  assert.deepEqual(swaggerTarget(DIST, '/swagger/swagger-ui.css'), {
    kind: 'asset',
    file: path.join(DIST, 'swagger-ui.css'),
  });
});

test('leaves other paths alone and refuses to leave the dist folder', () => {
  assert.equal(swaggerTarget(DIST, '/'), null);
  assert.equal(swaggerTarget(DIST, '/swaggerx'), null);
  assert.equal(swaggerTarget(DIST, '/swagger/../package.json'), null);
  assert.equal(swaggerTarget(DIST, '/swagger/%2e%2e/secret'), null);
  assert.equal(swaggerTarget(DIST, '/swagger/%E0%A4%A'), null);
});

test('maps the table of contents script', () => {
  assert.deepEqual(swaggerTarget(DIST, '/swagger/ct-toc.mjs'), { kind: 'toc' });
});

test('maps only the whitelisted brand fonts', () => {
  assert.deepEqual(swaggerTarget(DIST, '/swagger/fonts/Barlow-Regular.woff2'), {
    kind: 'font',
    name: 'Barlow-Regular.woff2',
  });
  assert.deepEqual(swaggerTarget(DIST, '/swagger/fonts/BigShouldersDisplay-Black.woff2'), {
    kind: 'font',
    name: 'BigShouldersDisplay-Black.woff2',
  });
  assert.equal(swaggerTarget(DIST, '/swagger/fonts/BigShouldersDisplay-Black.ttf'), null);
  assert.equal(swaggerTarget(DIST, '/swagger/fonts/../package.json'), null);
  assert.equal(swaggerTarget(DIST, '/swagger/fonts/%2e%2e%2fpackage.json'), null);
});

test('the theme declares @font-face for every whitelisted font', async () => {
  const { readFile } = await import('node:fs/promises');
  const { FONT_FILES } = await import('../../apps/web/tools/swagger-route.mjs');
  const css = await readFile(path.join(import.meta.dirname, '../../apps/web/tools/swagger-theme.css'), 'utf8');
  for (const name of FONT_FILES) {
    assert.ok(css.includes(`./fonts/${name}`), name);
  }
});

test('strips /api from proxied paths, keeping the query', () => {
  assert.equal(apiPath('/api/v1/health'), '/v1/health');
  assert.equal(apiPath('/api/v1/turf/cells?zoom=13'), '/v1/turf/cells?zoom=13');
  assert.equal(apiPath('/api'), '/');
  assert.equal(apiPath('/apiary'), null);
  assert.equal(apiPath('/en'), null);
});

test('the page loads Swagger UI with the spec next to it', () => {
  const html = swaggerHtml();
  assert.match(html, /url: '\.\/openapi\.json'/);
  assert.match(html, /swagger-ui-bundle\.js/);
  // Same options as the API's own /swagger (apps/api/src/spec.ts SWAGGER_UI_OPTIONS): planned
  // routes are visible through their x-cityturfer-status extension.
  assert.match(html, /showExtensions: true/);
  assert.match(html, /docExpansion: 'list'/);
  assert.match(html, /syntaxHighlight: \{ activated: true, theme: 'obsidian' \}/);
  // Dark page, like the app: the browser's own controls and scrollbars follow.
  assert.match(html, /<meta name="color-scheme" content="dark" \/>/);
  // Table of contents: an empty nav beside Swagger UI, filled by ./ct-toc.mjs once the spec is in.
  assert.match(html, /<nav id="ct-toc"/);
  assert.match(html, /<script type="module" src="\.\/ct-toc\.mjs"><\/script>/);
  assert.match(html, /onComplete:/);
  // The guide is rendered after the schemas, the order the contents list it in.
  assert.match(html, /plugins: \[GuideLast\]/);
});

let dist;
let api;
let site;
let siteUrl;
let downSite;
let downUrl;

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));

before(async () => {
  dist = await mkdtemp(path.join(tmpdir(), 'swagger-route-'));
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, 'swagger-ui.css'), 'body{}');
  await writeFile(path.join(dist, 'openapi.json'), '{"openapi":"3.1.0"}');

  api = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ method: req.method, url: req.url, body }));
    });
  });
  const apiUrl = await listen(api);

  const next = (_req, res) => {
    res.writeHead(200);
    res.end('next');
  };
  site = createServer(withSwagger(next, { distRoot: dist, specFile: path.join(dist, 'openapi.json'), apiUrl }));
  siteUrl = await listen(site);
  // A site whose API isn't running (nothing listens on port 9).
  downSite = createServer(
    withSwagger(next, { distRoot: dist, specFile: path.join(dist, 'missing.json'), apiUrl: 'http://127.0.0.1:9' })
  );
  downUrl = await listen(downSite);
});

after(async () => {
  await Promise.all([api, site, downSite].map((s) => new Promise((r) => s.close(r))));
  await rm(dist, { recursive: true, force: true });
});

test('redirects /swagger to /swagger/ and serves the page, spec and assets', async () => {
  const redirect = await fetch(`${siteUrl}/swagger`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/swagger/');

  const page = await fetch(`${siteUrl}/swagger/`);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /SwaggerUIBundle/);

  const spec = await fetch(`${siteUrl}/swagger/openapi.json`);
  assert.deepEqual(await spec.json(), { openapi: '3.1.0' });

  const css = await fetch(`${siteUrl}/swagger/swagger-ui.css`);
  assert.match(css.headers.get('content-type'), /text\/css/);

  const toc = await fetch(`${siteUrl}/swagger/ct-toc.mjs`);
  assert.match(toc.headers.get('content-type'), /text\/javascript/);
  assert.match(await toc.text(), /export function tocEntries/);
});

test('proxies /api to the API with method, path, query and body', async () => {
  const res = await fetch(`${siteUrl}/api/v1/activities/abc?x=1`, { method: 'PUT', body: '{"type":"run"}' });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { method: 'PUT', url: '/v1/activities/abc?x=1', body: '{"type":"run"}' });
});

test('passes other paths to Next', async () => {
  assert.equal(await (await fetch(`${siteUrl}/en`)).text(), 'next');
});

test('explains a missing spec and an API that is not running', async () => {
  const spec = await fetch(`${downUrl}/swagger/openapi.json`);
  assert.equal(spec.status, 404);
  assert.match(await spec.text(), /run openapi/);

  const api = await fetch(`${downUrl}/api/v1/health`);
  assert.equal(api.status, 502);
  assert.equal((await api.json()).code, 'api-not-running');
});
