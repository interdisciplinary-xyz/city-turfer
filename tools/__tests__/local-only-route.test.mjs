import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { isLocalOnlyPath, withLocalOnly } from '../../apps/web/tools/local-only-route.mjs';
import { isLocalClient } from '../../packages/dev-toolbar/src/node/local-client.js';

const LOCALES = ['en', 'pl'];

test('matches the dev pages and everything below them', () => {
  for (const p of [
    '/swagger',
    '/swagger/',
    '/swagger/openapi.json',
    '/storybook/iframe.html',
    '/branding',
    '/api/v1/health',
  ]) {
    assert.equal(isLocalOnlyPath(p, undefined, LOCALES), true, p);
  }
});

test('matches them behind a locale, in any case, and percent-encoded', () => {
  assert.equal(isLocalOnlyPath('/en/branding', undefined, LOCALES), true);
  assert.equal(isLocalOnlyPath('/pl/branding/colours', undefined, LOCALES), true);
  assert.equal(isLocalOnlyPath('/Swagger/', undefined, LOCALES), true);
  assert.equal(isLocalOnlyPath('/%73wagger', undefined, LOCALES), true);
});

test('leaves the site alone', () => {
  for (const p of [
    '/',
    '/en',
    '/pl',
    '/swaggerish',
    '/brandingx',
    '/en/storybookish',
    '/xx/branding',
    '/_next/static/a.js',
  ]) {
    assert.equal(isLocalOnlyPath(p, undefined, LOCALES), false, p);
  }
});

let server;
let base;
let forwardedFor;

before(async () => {
  const handler = withLocalOnly(
    (_req, res) => {
      res.writeHead(200);
      res.end('ok');
    },
    {
      // Simulates portless --lan: the socket is loopback, the real peer is in X-Forwarded-For.
      isLocal: (req) => {
        if (forwardedFor) {
          req.headers['x-forwarded-for'] = forwardedFor;
        }
        return isLocalClient(req);
      },
      locales: LOCALES,
    }
  );
  server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('this machine gets the dev pages', async () => {
  forwardedFor = '127.0.0.1';
  assert.equal((await fetch(`${base}/swagger/`)).status, 200);
  assert.equal((await fetch(`${base}/storybook/`)).status, 200);
  assert.equal((await fetch(`${base}/branding`)).status, 200);
});

test('another device on the LAN gets 404 for them, but still sees the site', async () => {
  forwardedFor = '192.168.0.42';
  for (const p of ['/swagger/', '/storybook/', '/branding', '/en/branding', '/api/v1/health']) {
    assert.equal((await fetch(`${base}${p}`)).status, 404, p);
  }
  assert.equal((await fetch(`${base}/en`)).status, 200);
});

test('a forged loopback entry in front of the real peer does not help', async () => {
  forwardedFor = '127.0.0.1, 192.168.0.42';
  assert.equal((await fetch(`${base}/swagger/`)).status, 404);
});
