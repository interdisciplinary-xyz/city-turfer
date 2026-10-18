/**
 * "Is this request from the developer's own machine?" — the gate for the
 * dev toolbar and the `/__dev/*` endpoints.
 *
 * `pnpm start:dev` runs Portless with `--lan`, so other devices on the
 * network can open `https://myapp.local`. Portless proxies them in from
 * 127.0.0.1, which makes the socket address useless on its own: every
 * request looks loopback. Portless APPENDS the real peer to
 * `X-Forwarded-For`, so the last entry is trustworthy even if a client
 * forged earlier ones. A direct connection (no proxy) has no header and
 * the socket address is the client.
 *
 * `DEV_LOCAL_CLIENT_HEADER` (`../protocol.js`) is set by `markLocalClient`
 * on requests from this machine; `shouldRenderDevToolbar()` reads it.
 */

import { DEV_LOCAL_CLIENT_HEADER } from '../protocol.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function clientAddress(req) {
  const socketAddress = req.socket.remoteAddress ?? '';
  const forwarded = req.headers['x-forwarded-for'];
  if (LOOPBACK.has(socketAddress) && typeof forwarded === 'string') {
    const hops = forwarded.split(',').map((hop) => hop.trim());
    return hops.at(-1) ?? socketAddress;
  }
  return socketAddress;
}

export const isLocalClient = (req) => LOOPBACK.has(clientAddress(req));

/**
 * Strip any client-sent copy of the marker (so it can't be forged from the
 * LAN), then set it iff the request really comes from this machine.
 */
export function markLocalClient(req) {
  delete req.headers[DEV_LOCAL_CLIENT_HEADER];
  if (isLocalClient(req)) {
    req.headers[DEV_LOCAL_CLIENT_HEADER] = '1';
  }
}
