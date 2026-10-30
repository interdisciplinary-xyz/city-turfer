import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { forwardHeaders, isAdminPath, routeAdminUpgrades, withAdmin } from '../../apps/web/tools/admin-route.mjs';
import { composeDevRoutes } from '../../apps/web/tools/dev-routes.mjs';

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));

test('takes /admin and everything below it, nothing else', () => {
  for (const p of [
    '/admin',
    '/admin/',
    '/admin/login',
    '/admin/api/staff/me',
    '/admin/_next/static/a.js',
    '/admin?x=1',
  ]) {
    assert.equal(isAdminPath(p), true, p);
  }
  for (const p of ['/', '/en', '/administrator', '/api/v1/health', '/_next/static/a.js', '/en/admin']) {
    assert.equal(isAdminPath(p), false, p);
  }
});

let admin;
let site;
let siteUrl;
let downUrl;
let downSite;
let seen;

before(async () => {
  admin = createServer((req, res) => {
    seen = {
      url: req.url,
      host: req.headers.host,
      fwdHost: req.headers['x-forwarded-host'],
      proto: req.headers['x-forwarded-proto'],
    };
    res.writeHead(200, { 'Content-Type': 'text/plain', 'X-From': 'admin' });
    res.end('admin');
  });
  admin.on('upgrade', (req, socket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
    socket.end(`upgraded ${req.url}`);
  });
  const adminUrl = await listen(admin);
  const next = (_req, res) => {
    res.writeHead(200);
    res.end('site');
  };
  site = createServer(withAdmin(next, { adminUrl }));
  routeAdminUpgrades(site, { adminUrl, isLocal: () => true });
  // The site's own upgrade listener (Next's HMR) must never see /admin sockets.
  site.on('upgrade', (_req, socket) => socket.end('HTTP/1.1 500 Site\r\n\r\n'));
  siteUrl = await listen(site);
  downSite = createServer(withAdmin(next, { adminUrl: 'http://127.0.0.1:9' }));
  downUrl = await listen(downSite);
});

after(async () => {
  await Promise.all([admin, site, downSite].map((s) => new Promise((resolve) => s.close(resolve))));
});

test('forwards /admin with its path and the public origin', async () => {
  const res = await fetch(`${siteUrl}/admin/login?next=1`, { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-from'), 'admin');
  assert.equal(await res.text(), 'admin');
  assert.equal(seen.url, '/admin/login?next=1');
  assert.equal(seen.fwdHost, new URL(siteUrl).host);
  assert.equal(seen.proto, 'https');
  assert.notEqual(seen.host, seen.fwdHost);
});

test('leaves the rest of the site to Next', async () => {
  assert.equal(await (await fetch(`${siteUrl}/en`)).text(), 'site');
});

test('says how to start the admin when it is not running', async () => {
  const res = await fetch(`${downUrl}/admin`);
  assert.equal(res.status, 502);
  assert.match(await res.text(), /pnpm --filter @cityturfer\/admin dev/);
});

function rawUpgrade(url, path) {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    import('node:net').then(({ connect }) => {
      const socket = connect(Number(port), hostname, () => {
        socket.write(`GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n`);
      });
      let data = '';
      socket.on('data', (chunk) => (data += chunk));
      socket.on('end', () => resolve(data));
      socket.on('error', reject);
    });
  });
}

test('pipes /admin WebSockets (HMR) to the admin, others to the site', async () => {
  assert.match(await rawUpgrade(siteUrl, '/admin/_next/hmr'), /101[\s\S]*upgraded \/admin\/_next\/hmr/);
  assert.match(await rawUpgrade(siteUrl, '/_next/hmr'), /500 Site/);
});

test('refuses /admin WebSockets from another device', async () => {
  const lan = createServer();
  routeAdminUpgrades(lan, { adminUrl: 'http://127.0.0.1:9', isLocal: () => false });
  const lanUrl = await listen(lan);
  assert.match(await rawUpgrade(lanUrl, '/admin/_next/hmr'), /404/);
  await new Promise((resolve) => lan.close(resolve));
});

test('x-forwarded-proto defaults to https and only accepts http or https; the host is the request Host', () => {
  const target = new URL('http://127.0.0.1:3100');
  const headers = (h) => forwardHeaders({ headers: h }, target);
  assert.equal(headers({ host: 'cityturfer.local' })['x-forwarded-proto'], 'https');
  assert.equal(headers({ host: 'cityturfer.local', 'x-forwarded-proto': 'http' })['x-forwarded-proto'], 'http');
  assert.equal(headers({ host: 'cityturfer.local', 'x-forwarded-proto': 'evil' })['x-forwarded-proto'], 'https');
  // A client-supplied x-forwarded-host never wins over the Host header.
  const h = headers({ host: 'cityturfer.local', 'x-forwarded-host': 'evil.example' });
  assert.equal(h['x-forwarded-host'], 'cityturfer.local');
  assert.equal(h.host, '127.0.0.1:3100');
  // Without Host (HTTP/2 :authority), portless's own x-forwarded-host is used.
  assert.equal(headers({ 'x-forwarded-host': 'cityturfer.local' })['x-forwarded-host'], 'cityturfer.local');
});

test('the dev server composition keeps /admin local-only, in front of the proxy', async () => {
  let reachedAdmin = false;
  const upstream = createServer((_req, res) => {
    reachedAdmin = true;
    res.end('admin');
  });
  const adminUrl = await listen(upstream);
  const site = (_req, res) => res.end('site');
  const isLocal = (req) => req.headers['x-test-local'] === '1';
  const server = createServer(composeDevRoutes(site, { isLocal, locales: ['en', 'pl'], adminUrl }));
  const url = await listen(server);
  try {
    for (const p of ['/admin', '/admin/api/staff/me', '/en/admin', '/Admin']) {
      const res = await fetch(`${url}${p}`);
      assert.equal(res.status, 404, p);
    }
    assert.equal(reachedAdmin, false, 'a non-local request never reaches the admin');
    const local = await fetch(`${url}/admin`, { headers: { 'x-test-local': '1' } });
    assert.equal(await local.text(), 'admin');
    assert.equal(reachedAdmin, true);
    assert.equal(await (await fetch(`${url}/en`)).text(), 'site');
  } finally {
    await Promise.all([server, upstream].map((s) => new Promise((resolve) => s.close(resolve))));
  }
});

test('aborts the upstream request when the client goes away', async () => {
  let upstreamClosed;
  const closed = new Promise((resolve) => (upstreamClosed = resolve));
  const slow = createServer((req) => {
    req.on('close', upstreamClosed);
  });
  const adminUrl = await listen(slow);
  const server = createServer(withAdmin(() => {}, { adminUrl }));
  const url = await listen(server);
  const controller = new AbortController();
  const pending = fetch(`${url}/admin`, { signal: controller.signal }).catch(() => {});
  setTimeout(() => controller.abort(), 100);
  await pending;
  await Promise.race([
    closed,
    new Promise((_, reject) => setTimeout(() => reject(new Error('upstream left open')), 3000)),
  ]);
  slow.closeAllConnections();
  server.closeAllConnections();
  await Promise.all([server, slow].map((s) => new Promise((resolve) => s.close(resolve))));
});

test('refuses /admin WebSockets when ADMIN_DEV_URL is not plain http', async () => {
  const bad = createServer();
  routeAdminUpgrades(bad, { adminUrl: 'https://127.0.0.1:3100', isLocal: () => true });
  const badUrl = await listen(bad);
  assert.match(await rawUpgrade(badUrl, '/admin/_next/hmr'), /502/);
  await new Promise((resolve) => bad.close(resolve));
});
