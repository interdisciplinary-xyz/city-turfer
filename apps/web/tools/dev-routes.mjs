// Dev only: the order of the dev server's request wrappers, in one place so a test can pin it.
import { withAdmin } from './admin-route.mjs';
import { withLocalOnly } from './local-only-route.mjs';

/**
 * Local-only outermost (another device gets a 404 before anything is proxied), then the admin proxy,
 * then `wrapSite(siteHandler)`: Swagger, Storybook and the site itself.
 */
export function composeDevRoutes(siteHandler, { isLocal, locales, adminUrl, wrapSite = (handler) => handler }) {
  return withLocalOnly(withAdmin(wrapSite(siteHandler), { adminUrl }), { isLocal, locales });
}
