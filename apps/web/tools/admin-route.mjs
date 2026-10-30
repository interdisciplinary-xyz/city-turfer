// Dev only: the staff admin (apps/admin, Payload CMS) on the local site, at
// https://cityturfer.local/admin, by proxying /admin/* to the admin's own dev server
// (`pnpm --filter @cityturfer/admin dev`, http://127.0.0.1:3100).
//
// The admin's Next basePath is /admin (apps/admin/src/admin-path.ts), so its pages, its REST API
// (/admin/api) and its Next files (/admin/_next, including the HMR WebSocket) all sit under this one
// prefix and never clash with the site's own /api and /_next. Only this machine may open it
// (local-only-route.mjs), like Swagger and Storybook.
//
// Dev only. In production the admin keeps its OWN origin (apps/admin/src/admin-path.ts), never a
// rewrite under the public site's origin.
//
// ADMIN_DEV_URL (env, read by server.mjs) overrides where the admin dev server is; it must be a
// plain `http://host:port` (the WebSocket path speaks raw TCP). The default port 3100 is also in
// apps/admin/package.json (`dev` script: PORT and --port): change both together, or set
// ADMIN_DEV_URL and run the admin with the same port.
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';

export const ADMIN_PREFIX = '/admin';
// Keep in step with apps/admin/package.json (`dev` script, port 3100); this .mjs can't import admin TS.
export const DEFAULT_ADMIN_URL = 'http://127.0.0.1:3100';

/** Whether `url` (path and query) belongs to the admin: /admin itself or anything below it. */
export function isAdminPath(url) {
  const urlPath = (url ?? '/').split('?')[0];
  return urlPath === ADMIN_PREFIX || urlPath.startsWith(`${ADMIN_PREFIX}/`);
}

/**
 * Headers for the admin: the target's Host, plus where the request really came from, so Next's
 * Server Actions origin check and Payload's CSRF check (ADMIN_URL=https://cityturfer.local) see the
 * public origin rather than 127.0.0.1:3100.
 *
 * Derived here, not trusted: portless keeps any x-forwarded-host/-proto the client sent, so the
 * forwarded host is the request's own Host (the x-forwarded-host portless sets from HTTP/2's
 * :authority only when Host is missing), and the proto is `http` only when the incoming value is
 * exactly `http`, otherwise `https` (portless serves the site over TLS).
 */
export function forwardHeaders(req, target) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = req.headers.host || (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || '';
  return {
    ...req.headers,
    host: target.host,
    'x-forwarded-host': host,
    'x-forwarded-proto': req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https',
  };
}

function notRunning(res) {
  res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end('The admin dev server is not running.\nStart it with: pnpm --filter @cityturfer/admin dev\n');
}

/** Forwards one request to the admin, streaming both ways. Never logs bodies. */
function proxy(req, res, adminUrl) {
  const target = new URL(req.url ?? ADMIN_PREFIX, adminUrl);
  const upstream = httpRequest(target, { method: req.method, headers: forwardHeaders(req, target) }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) {
      notRunning(res);
    } else {
      res.end();
    }
  });
  // A client that goes away (closed tab, aborted fetch) must not leave the upstream request open.
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}

/** Wraps a request handler: /admin/* goes to the admin dev server, everything else to `next`. */
export function withAdmin(next, { adminUrl = DEFAULT_ADMIN_URL } = {}) {
  return (req, res) => {
    if (isAdminPath(req.url)) {
      proxy(req, res, adminUrl);
      return undefined;
    }
    return next(req, res);
  };
}

/**
 * An `upgrade` listener for the site's HTTP server: WebSockets under /admin (Next's HMR) are piped
 * to the admin dev server as raw TCP. Returns true when it took the socket. `isLocal(req)` keeps
 * other devices out, as for the pages.
 */
export function adminUpgrade(req, socket, head, { adminUrl = DEFAULT_ADMIN_URL, isLocal = () => false } = {}) {
  if (!isAdminPath(req.url)) {
    return false;
  }
  if (!isLocal(req)) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return true;
  }
  const target = new URL(adminUrl);
  if (target.protocol !== 'http:') {
    // Raw TCP below: https:// (or anything else) would not work, so say so instead of hanging.
    socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    return true;
  }
  const upstream = connect(Number(target.port || 80), target.hostname, () => {
    const headers = forwardHeaders(req, target);
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [key, value] of Object.entries(headers)) {
      for (const v of Array.isArray(value) ? value : [value]) {
        lines.push(`${key}: ${v}`);
      }
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) {
      upstream.write(head);
    }
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  return true;
}

/**
 * Hands /admin WebSockets to `adminUpgrade` before any other `upgrade` listener sees them: Next's
 * custom server listens for upgrades too (the site's own HMR) and must not answer the admin's.
 */
export function routeAdminUpgrades(server, options) {
  const emit = server.emit.bind(server);
  server.emit = (event, ...args) => {
    if (event === 'upgrade' && adminUpgrade(args[0], args[1], args[2], options)) {
      return true;
    }
    return emit(event, ...args);
  };
  // Node emits `upgrade` only when someone listens; Next may not have attached its listener yet.
  // A socket that reaches this one and no other has nobody to answer it. Best effort only: Node
  // closes an unanswered upgrade socket itself, and the count can't tell Next's listener apart.
  server.on('upgrade', (_req, socket) => {
    if (server.listenerCount('upgrade') === 1) {
      socket.destroy();
    }
  });
  return server;
}
