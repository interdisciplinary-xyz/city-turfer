/**
 * `@interdisciplinary/dev-toolbar/node` — the plain-Node half, imported by the host
 * app's custom `server.js` in development only:
 *
 *   const node = await import('@interdisciplinary/dev-toolbar/node');
 *   const warmUp = node.withDevWarmUp(
 *     node.withDevRequestLog(handler, {
 *       port,
 *       appDir: path.join(process.cwd(), 'src/app/(frontend)'),
 *     }),
 *     { port, path: '/api/pages?limit=1&depth=0' }
 *   );
 *   // … createServer(warmUp.handler).listen(port, () => warmUp.start());
 *
 * Plain ESM JavaScript (JSDoc types): no TS loader runs at that point.
 */
export { withDevRequestLog } from './request-log.js';
export { withDevWarmUp } from './warm-up.js';
