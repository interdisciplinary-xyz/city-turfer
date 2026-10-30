import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { isAdminPath, routeAdminUpgrades, withAdmin } from '../../apps/web/tools/admin-route.mjs';

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
