// Dev only: pages that are for the developer, not for other devices on the portless `--lan` URL
// (a phone on the same Wi-Fi). Same rule as the dev toolbar: a request from this machine gets
// through, anything else gets a plain 404, so the page looks like it doesn't exist.
//
// "From this machine" comes from the dev toolbar's own check (`isLocalClient` in
// @interdisciplinary/dev-toolbar/node), so the toolbar and these pages can never disagree.

/** Path prefixes only this machine may open. `/api` is Swagger's "Try it out" proxy. */
export const LOCAL_ONLY_PREFIXES = ['/swagger', '/storybook', '/branding', '/api'];

/**
 * Whether `urlPath` is one of `prefixes` or below it — also behind a locale segment
 * (`/en/branding`), in case one of them becomes a Next page under `[locale]`.
 */
export function isLocalOnlyPath(urlPath, prefixes = LOCAL_ONLY_PREFIXES, locales = []) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }
  const lower = decoded.toLowerCase();
  const segments = lower.split('/').filter(Boolean);
  const first = segments[0] === undefined ? '' : `/${segments[0]}`;
  const second = segments[1] === undefined ? '' : `/${segments[1]}`;
  const underLocale = locales.includes(segments[0] ?? '');
  return prefixes.some((prefix) => first === prefix || (underLocale && second === prefix));
}

/** Wraps a request handler: local-only paths answer 404 unless `isLocal(req)`. */
export function withLocalOnly(next, { isLocal, prefixes = LOCAL_ONLY_PREFIXES, locales = [] }) {
  return (req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    if (isLocalOnlyPath(urlPath, prefixes, locales) && !isLocal(req)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Not found\n');
      return undefined;
    }
    return next(req, res);
  };
}
