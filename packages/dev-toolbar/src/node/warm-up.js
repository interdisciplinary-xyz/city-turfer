/**
 * Dev-only: compile a route of the host app right after the dev server
 * starts, and hold other requests until it has.
 *
 * Why: a host whose pages self-fetch its own API (e.g. CMS pages calling a
 * Payload catch-all under `/api/*`) makes the FIRST page render after a
 * cold start wait ~25 s for that route to compile — and when the compile
 * lands mid-render, Next dev swaps its server modules under the render.
 * Client components loaded after the swap get a second instance of a React
 * context (e.g. next-intl's, reached through a header → auth hook →
 * `useTranslations`) and throw "context … was not found": a 500 on the first
 * page after every restart. Reproduced and confirmed 2026-09-27: with that
 * route compiled first, the same first render returns 200.
 *
 * Holding requests matters: a browser tab reloads the moment the server
 * is back, so warming up in the background alone would still race it.
 *
 * Production never compiles at runtime, so the host calls this in dev only
 * (see its server.js). Any failure — or `WARM_UP_TIMEOUT_MS` — releases the
 * hold: worst case is the old behaviour, never a stuck server.
 *
 * Plain ESM JavaScript (JSDoc types): `server.js` imports it with `node`.
 */
import http from 'node:http';

/** Marks the warm-up's own request so the hold lets it through. */
const WARM_UP_HEADER = 'x-dev-warm-up';
const WARM_UP_TIMEOUT_MS = 120_000;

/**
 * Wrap the request handler so requests wait for the warm-up. Call the
 * returned `start()` once the server is listening.
 *
 * @template {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => unknown} H
 * @param {H} handler
 * @param {{ port: number; path: string }} options `path` is the host app's
 *   route to compile first (path + query, e.g. `/api/pages?limit=1&depth=0`).
 * @returns {{ handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => unknown; start: () => void }}
 */
export function withDevWarmUp(handler, { port, path }) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('withDevWarmUp: `path` must be the host route to compile first, starting with "/".');
  }

  /** @type {() => void} */
  let release = () => {};
  /** @type {Promise<void>} */
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  let warm = false;

  const start = () => {
    const startedAt = Date.now();
    /** @param {string} message */
    const done = (message) => {
      if (warm) {
        return;
      }
      warm = true;
      console.warn(`> Dev warm-up: ${message} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
      release();
    };
    // Never hold requests longer than this, whatever happens below.
    setTimeout(() => done('gave up waiting'), WARM_UP_TIMEOUT_MS).unref();

    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path,
        headers: { [WARM_UP_HEADER]: '1' },
      },
      (res) => {
        res.resume();
        res.on('end', () => done(`${path} compiled (${res.statusCode})`));
        res.on('error', () => done('response failed'));
      }
    );
    req.on('error', (error) => done(`skipped (${error.message})`));
  };

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  const gated = (req, res) => {
    if (warm || req.headers[WARM_UP_HEADER] === '1') {
      return handler(req, res);
    }
    return ready.then(() => handler(req, res));
  };

  return { handler: gated, start };
}
