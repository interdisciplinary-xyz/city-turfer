/**
 * `./node` is the dev toolbar's plain-Node half. It is JavaScript, not
 * TypeScript, on purpose: the host app's custom `server.js` imports it
 * directly with `node` — outside the Next build, so no TS transpile — and
 * only when `NODE_ENV !== 'production'`. Nothing in the app bundle imports it.
 *
 * Dev-only server-side request log for the dev toolbar's request logger.
 *
 * Records every OUTGOING request the Node server makes — `fetch` (undici)
 * and `http`/`https` (Stripe, Firebase Admin, gaxios) — via
 * `node:diagnostics_channel`. The one patch is a thin `fetch` wrapper that
 * measures the decoded response body (a clone), since Node 22 publishes no
 * body-size event; `http`/`https` sizes come from `Content-Length` when the
 * response declares one. Each request is
 * tagged with the page that caused it through an AsyncLocalStorage context
 * opened around every incoming request in `server.js`:
 *
 *   - a page render / RSC navigation      → that page's pathname
 *   - an `/api/*` call from the browser   → the Referer's pathname
 *   - a `/_next/*` request (e.g. the image
 *     optimizer downloading remote images) → the Referer's pathname, or
 *                                           background when there is none
 *   - an SSR self-fetch to our own `/api` → the page forwarded in the
 *                                           `x-dev-page` header we add below
 *
 * The toolbar polls `GET ${DEV_REQUEST_LOG_PATH}?after=<epochMs>&since=<id>`.
 * Loaded only when `NODE_ENV !== 'production'` (see server.js). The
 * endpoints answer this machine only (see local-client.js), and every
 * request is marked local / not local for the dev toolbar gate.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import diagnostics from 'node:diagnostics_channel';

import { DEV_PATH_PREFIX, DEV_REQUEST_LOG_PATH, DEV_ROUTES_PATH } from '../protocol.js';
import { isLocalClient, markLocalClient } from './local-client.js';
import { readRouteInventory } from './route-inventory.js';

const PAGE_HEADER = 'x-dev-page';
const LIMIT = 1000;

const context = new AsyncLocalStorage();
/** @type {Array<Record<string, unknown>>} */
let entries = [];
let nextId = 1;
/** @type {WeakMap<object, Record<string, unknown> & { t0: number }>} */
const inFlight = new WeakMap();
/** @type {Set<string>} origins that are this dev server itself */
let selfOrigins = new Set();

// Framework beacons that fire during whichever request happens to be first
// after a (re)start. Kept in the log, but as background (`page: null`) so
// they don't pollute that page's request count.
const BACKGROUND_HOSTS = new Set(['telemetry.nextjs.org', 'telemetry.payloadcms.com']);

const isFrameworkPath = (path) =>
  path.startsWith('/_next/') ||
  path.startsWith('/__nextjs') ||
  path.startsWith(DEV_PATH_PREFIX) ||
  /[?&]_rsc=/.test(path);

const pathnameOf = (url) => {
  try {
    return new URL(url, 'http://x').pathname;
  } catch {
    return url;
  }
};

function start(request, { method, origin, path }) {
  const store = context.getStore();
  if (isFrameworkPath(path)) {
    return;
  }
  const self = selfOrigins.has(origin);
  const background = BACKGROUND_HOSTS.has(origin.replace(/^https?:\/\//, '').replace(/:\d+$/, ''));
  const entry = {
    id: nextId++,
    method: String(method).toUpperCase(),
    url: self ? path : `${origin.replace(/^https?:\/\//, '')}${path}`,
    page: background ? null : (store?.page ?? null),
    via: store?.via ?? null,
    status: 'pending',
    startedAt: Date.now(),
    durationMs: null,
    sizeBytes: null,
    t0: performance.now(),
  };
  entries.push(entry);
  if (entries.length > LIMIT) {
    entries = entries.slice(-LIMIT);
  }
  inFlight.set(request, entry);
  // Hand the entry to the enclosing fetch wrapper so it can record the size.
  // Redirect hops overwrite it, leaving the final response's entry.
  if (store?.sizeSink) {
    store.sizeSink.entry = entry;
  }
  return self;
}

function finish(request, patch) {
  const entry = inFlight.get(request);
  if (!entry) {
    return;
  }
  Object.assign(entry, patch, {
    durationMs: Math.round(performance.now() - entry.t0),
  });
}

/** Content-Length from undici's raw `[name, value, name, value…]` buffers. */
function contentLengthFromRaw(raw) {
  for (let i = 0; raw && i < raw.length; i += 2) {
    if (String(raw[i]).toLowerCase() === 'content-length') {
      const n = Number(String(raw[i + 1]));
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function subscribe() {
  // --- fetch (undici) -----------------------------------------------------
  diagnostics.subscribe('undici:request:create', ({ request }) => {
    const self = start(request, request);
    // Carry the originating page across our own SSR → /api hop. Only ever
    // sent to our own origin, never to a third party.
    const page = context.getStore()?.page;
    if (self && page) {
      request.addHeader(PAGE_HEADER, page);
    }
  });
  diagnostics.subscribe('undici:request:headers', ({ request, response }) => {
    const entry = inFlight.get(request);
    if (entry) {
      entry.status = response.statusCode;
      entry.sizeBytes = contentLengthFromRaw(response.headers);
    }
  });
  diagnostics.subscribe('undici:request:trailers', ({ request }) => {
    finish(request, {});
  });
  diagnostics.subscribe('undici:request:error', ({ request }) => {
    finish(request, { status: 'failed' });
  });

  // --- http / https (Stripe, Firebase Admin, gaxios) ----------------------
  diagnostics.subscribe('http.client.request.start', ({ request }) => {
    const protocol = request.protocol ?? 'http:';
    const host = request.getHeader?.('host') ?? request.host;
    start(request, {
      method: request.method,
      origin: `${protocol}//${host}`,
      path: request.path,
    });
  });
  diagnostics.subscribe('http.client.response.finish', ({ request, response }) => {
    const length = Number(response.headers['content-length']);
    const entry = inFlight.get(request);
    if (entry) {
      entry.status = response.statusCode;
      entry.sizeBytes = Number.isFinite(length) ? length : null;
    }
    // Status is known at headers; duration runs to the end of the body.
    response.once('end', () => finish(request, {}));
    response.once('close', () => finish(request, {}));
  });
  diagnostics.subscribe('http.client.request.error', ({ request }) => {
    finish(request, { status: 'failed' });
  });
}

function resolvePage(req) {
  const forwarded = req.headers[PAGE_HEADER];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded;
  }
  const own = pathnameOf(req.url ?? '/');
  const framework = own.startsWith('/_next/');
  if ((framework || own.startsWith('/api/')) && typeof req.headers.referer === 'string') {
    try {
      const referer = new URL(req.headers.referer);
      if (referer.host === req.headers.host) {
        return referer.pathname;
      }
    } catch {
      // fall through
    }
  }
  // Framework traffic isn't a page of its own.
  return framework ? null : own;
}

const sendJson = (res, body, status = 200) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
};

function serveLog(req, res) {
  const url = new URL(req.url ?? '/', 'http://x');
  const since = Number(url.searchParams.get('since') ?? 0);
  const after = Number(url.searchParams.get('after') ?? 0);
  const body = {
    // Pending entries are re-sent until they settle, so the client keeps
    // `since` at the oldest still-pending id rather than the newest id.
    entries: entries
      .filter((e) => e.id > since && e.startedAt >= after)
      .map((entry) => {
        const rest = { ...entry };
        delete rest.t0;
        return rest;
      }),
    lastId: nextId - 1,
  };
  sendJson(res, body);
}

/**
 * Wrap global `fetch` so each response's decoded body size lands on the
 * entry the diagnostics hook created for it. Runs the real fetch in a child
 * context carrying a `sizeSink`; the `undici:request:create` hook fills it.
 * Installed before Next patches `fetch`, so Next's data cache sits in front:
 * cache hits make no request and are (correctly) not logged.
 */
function wrapFetch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function devRequestLogFetch(input, init) {
    const sink = { entry: null };
    const store = context.getStore() ?? { page: null, via: null };
    return context
      .run({ ...store, sizeSink: sink }, () => originalFetch(input, init))
      .then((response) => {
        const { entry } = sink;
        const type = response.headers.get('content-type') ?? '';
        if (entry && !type.includes('text/event-stream')) {
          response
            .clone()
            .arrayBuffer()
            .then((body) => {
              entry.sizeBytes = body.byteLength;
            })
            .catch(() => {
              // Aborted — keep the Content-Length figure, if any.
            });
        }
        return response;
      });
  };
}

/**
 * @typedef {object} DevRequestLogOptions
 * @property {number} port The port the dev server listens on (its own origin).
 * @property {string} appDir Absolute path of the App Router directory whose
 *   `page.tsx` files make up the route map (e.g. `<app>/src/app/(frontend)`).
 * @property {string} [localeSegment] The dynamic locale segment to drop from
 *   route patterns. Default `'[locale]'`.
 */

/**
 * Wrap the Next request handler: serve the log endpoint, and run every
 * other request inside a context naming the page it belongs to.
 *
 * @template {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => unknown} H
 * @param {H} handler
 * @param {DevRequestLogOptions} options
 */
export function withDevRequestLog(handler, { port, appDir, localeSegment = '[locale]' }) {
  subscribe();
  wrapFetch();
  selfOrigins = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '[::1]'].map((host) => `http://${host}:${port}`));
  return (req, res) => {
    markLocalClient(req);
    if (req.url?.startsWith(DEV_PATH_PREFIX)) {
      if (!isLocalClient(req)) {
        res.writeHead(404).end();
      } else if (req.url.startsWith(DEV_REQUEST_LOG_PATH)) {
        serveLog(req, res);
      } else if (req.url.startsWith(DEV_ROUTES_PATH)) {
        // Always answer: a rejection here must not leave the toolbar's
        // request hanging with no hint of why.
        readRouteInventory(port, { appDir, localeSegment })
          .then((body) => sendJson(res, body))
          .catch((error) => {
            console.error('[dev route inventory]', error);
            sendJson(res, { error: String(error?.message ?? error) }, 500);
          });
      } else {
        res.writeHead(404).end();
      }
      return;
    }
    // Link prefetches render the TARGET page ahead of a click — label them,
    // or their server work reads as if the visited page had caused it.
    const prefetch = req.headers['next-router-prefetch'] === '1';
    const store = {
      page: resolvePage(req),
      via: `${pathnameOf(req.url ?? '/')}${prefetch ? ' (prefetch)' : ''}`,
    };
    return context.run(store, () => handler(req, res));
  };
}
