// The website for the portal E2E, as Vercel serves it: the static export (apps/web/out) over HTTPS,
// with vercel.json's redirects and headers, and its one route, `/api/v1/*` → the API's `/v1/*`
// (here the E2E API on PGlite). Same origin, so the API's `__Host-ct_session` cookie
// (Secure, HttpOnly, SameSite=Strict, Path=/, no Domain) is stored and sent like on the real site.
//
// HTTPS with a throwaway self-signed certificate for localhost (made with `openssl` in a temp
// folder, never committed); the browser runs with ignoreHTTPSErrors. Plain http can't stand in:
// the API only accepts an https WEB_ORIGIN for its CSRF guard.
//
// Env (set by playwright.config.ts): PORT, API_URL, E2E_CLIENT_IP (the visitor address this
// "edge" forwards in x-forwarded-for, the one the API buckets sign-in limits by; one per run).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const webRoot = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(webRoot, 'out');
const vercel = JSON.parse(readFileSync(path.join(webRoot, 'vercel.json'), 'utf8'));
const port = Number(process.env.PORT);
const apiUrl = new URL(process.env.API_URL);
const clientIp = process.env.E2E_CLIENT_IP || '203.0.113.10';

if (!existsSync(path.join(outDir, 'en.html'))) {
  throw new Error('No static export in apps/web/out: run `pnpm --filter @cityturfer/web build` first');
}

// The landing tests need the waitlist strip and the join link, which a build without the
// NEXT_PUBLIC_WAITLIST_* variables leaves out: refuse such an export rather than fail three tests.
if (!readFileSync(path.join(outDir, 'en.html'), 'utf8').includes('id="waitlist"')) {
  throw new Error(
    'apps/web/out was built without the waitlist variables (no #waitlist): run `pnpm --filter @cityturfer/web run test:e2e:build`'
  );
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

/** vercel.json `source` (path-to-regexp subset it uses) → RegExp. */
function sourceRegExp(source) {
  const pattern = source
    .replace(/\/:(\w+)\*/g, '(?:/.*)?')
    .replace(/:(\w+)\(([^)]+)\)/g, '($2)')
    .replace(/:(\w+)/g, '[^/]+');
  return new RegExp(`^${pattern}$`);
}

const headerRules = (vercel.headers ?? []).map((rule) => ({ re: sourceRegExp(rule.source), headers: rule.headers }));
const redirects = (vercel.redirects ?? []).map((rule) => ({ ...rule, re: sourceRegExp(rule.source) }));

function redirectFor(req, pathname) {
  for (const rule of redirects) {
    if (!rule.re.test(pathname)) {
      continue;
    }
    const matches = (rule.has ?? []).every(
      (cond) => cond.type === 'header' && new RegExp(cond.value, 'i').test(req.headers[cond.key] ?? '')
    );
    if (matches) {
      return rule.destination;
    }
  }
  return null;
}

/** `/en/account` → out/en/account.html, like Vercel's clean URLs for a Next export. */
function fileFor(pathname) {
  const clean = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = path.join(outDir, clean);
  if (!base.startsWith(outDir)) {
    return null;
  }
  for (const candidate of [base, `${base.replace(/\/$/, '')}.html`, path.join(base, 'index.html')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function proxy(req, res, targetPath) {
  const headers = { ...req.headers, host: apiUrl.host, 'x-forwarded-for': clientIp };
  const upstream = httpRequest(
    { hostname: apiUrl.hostname, port: apiUrl.port, method: req.method, path: targetPath, headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    }
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('E2E API not reachable');
  });
  req.pipe(upstream);
}

function certificate() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cityturfer-e2e-cert-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' }
  );
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

const server = createServer(certificate(), (req, res) => {
  const url = new URL(req.url ?? '/', 'https://localhost');
  if (url.pathname.startsWith('/api/v1/') || url.pathname === '/api/v1') {
    proxy(req, res, `${url.pathname.slice('/api'.length)}${url.search}`);
    return;
  }
  const destination = redirectFor(req, url.pathname);
  if (destination) {
    res.writeHead(307, { location: destination });
    res.end();
    return;
  }
  const extra = {};
  for (const rule of headerRules) {
    if (rule.re.test(url.pathname)) {
      for (const { key, value } of rule.headers) {
        extra[key] = value;
      }
    }
  }
  const file = fileFor(url.pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': TYPES['.html'], ...extra });
    res.end(readFileSync(path.join(outDir, '404.html')));
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', ...extra });
  res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`E2E site on https://localhost:${port} (out/ + /api/v1 → ${apiUrl.origin})\n`);
});
