/**
 * The dev-toolbar protocol: the literals the browser half (`./react`), the
 * render gate (`./next`) and the plain-Node server half (`./node`) must
 * agree on. ONE definition each — before the package existed they were
 * duplicated across the app and kept "in sync" by comments.
 *
 * Plain ESM JavaScript with JSDoc types, not TypeScript: `server.js` imports
 * the Node half (and through it this file) with plain `node`, outside the
 * Next build, so there is no TS loader at runtime.
 *
 * `scripts/tools/check-dev-toolbar-not-shipped.mjs` scans the production
 * client bundle for these strings — keep its MARKERS in step with them.
 */

/**
 * Set to `1` by the dev server (`./node/local-client.js`) on requests that
 * come from this machine — never on requests from other LAN devices reaching
 * the Portless `--lan` host. Any client-sent copy is stripped first, so it
 * can't be forged. Read by `shouldRenderDevToolbar()` (`./next`).
 */
export const DEV_LOCAL_CLIENT_HEADER = 'x-dev-local-client';

/** Every dev-server endpoint lives under this prefix (local clients only). */
export const DEV_PATH_PREFIX = '/__dev/';

/** Server-side request log, polled by the toolbar's request logger. */
export const DEV_REQUEST_LOG_PATH = '/__dev/request-log';

/** Route inventory (sitemap paths + `page.tsx` patterns) for the route map. */
export const DEV_ROUTES_PATH = '/__dev/routes';

/** Storage prefix used when the host app doesn't pass `storagePrefix`. */
export const DEFAULT_DEV_STORAGE_PREFIX = 'dev_';

/**
 * @typedef {{
 *   local: {
 *     TOOLBAR_COLLAPSED: string;
 *     TOOLBAR_LOGGER: string;
 *     ROUTE_MAP: string;
 *   };
 *   session: {
 *     ROUTE_MAP_PENDING_NAV: string;
 *     ROUTE_AUTOPLAY: string;
 *   };
 * }} DevStorageKeys
 */

/**
 * Browser storage keys of the dev tooling, namespaced by the host app's
 * prefix (e.g. `myapp_` → `myapp_dev_toolbar_collapsed`; the first host
 * passes the prefix its keys had before the package existed, so they are
 * unchanged). They only ever exist on a developer's machine.
 *
 * @param {string} prefix
 * @returns {DevStorageKeys}
 */
export function createDevStorageKeys(prefix) {
  return {
    local: {
      /** Toolbar collapsed to the corner pill. */
      TOOLBAR_COLLAPSED: `${prefix}dev_toolbar_collapsed`,
      /** API logger: active view + list open. */
      TOOLBAR_LOGGER: `${prefix}dev_toolbar_logger`,
      /** The persisted "routes visited × requests made" test run. */
      ROUTE_MAP: `${prefix}dev_route_map`,
    },
    session: {
      /**
       * The route a route-map link was clicked for, so the landing page can
       * tell a redirect (e.g. to a slug-translated URL) from a plain visit.
       * Consumed on the next page load.
       */
      ROUTE_MAP_PENDING_NAV: `${prefix}dev_route_map_pending_nav`,
      /** Route-map autoplay: running flag + routes already tried this run. */
      ROUTE_AUTOPLAY: `${prefix}dev_route_autoplay`,
    },
  };
}
