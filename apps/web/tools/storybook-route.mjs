// Dev only: serves the design system's static Storybook build at /storybook on the local site
// (https://cityturfer.local/storybook), so it sits next to the landing page it documents.
//
// The static build (`pnpm -C apps/storybook run build` → apps/storybook/storybook-static) uses
// relative URLs, so it works under a sub-path. Storybook's live dev server doesn't (it loads
// from the site root), so live editing stays on http://localhost:6006.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { APP_HEADER_SCRIPT, APP_HEADER_STYLES, appHeaderMarkup, appHeaderStylesheet } from './app-header-assets.mjs';

export const STORYBOOK_PREFIX = '/storybook';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Maps a request path to a file inside `root`, or null when it isn't a Storybook path or tries to
 * leave `root`. `/storybook` and `/storybook/` map to index.html.
 */
export function storybookFile(root, urlPath) {
  if (urlPath !== STORYBOOK_PREFIX && !urlPath.startsWith(`${STORYBOOK_PREFIX}/`)) {
    return null;
  }
  let rest;
  try {
    rest = decodeURIComponent(urlPath.slice(STORYBOOK_PREFIX.length));
  } catch {
    return null;
  }
  const relative = rest === '' || rest === '/' ? 'index.html' : rest.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return resolved;
}

export function contentTypeOf(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

export const TOOLBAR_SCRIPT = '__toolbar.js';
export const TOOLBAR_STYLES = '__toolbar.css';

/**
 * Storybook's index.html with the dev toolbar added (stylesheet in the head, mount node and script
 * at the end of the body). Storybook's own UI lives in #root and is untouched; the toolbar is a
 * fixed overlay of its own.
 */
export function withToolbar(html) {
  return html
    .replace('</head>', `<link rel="stylesheet" href="./${TOOLBAR_STYLES}" /></head>`)
    .replace('</body>', `<div id="dev-toolbar-root"></div><script src="./${TOOLBAR_SCRIPT}"></script></body>`);
}

/**
 * Storybook's index.html under the site's header (the same bar as /en): the header first in the
 * body, and Storybook's UI (#root) pinned to the space below it. The header carries the logo, so
 * the sidebar swaps its own logo for a plain "Design system" label (theme.ts BRAND_TITLE).
 */
export function withAppHeader(html) {
  const layout =
    '<style>#root { position: fixed; inset: var(--header-h) 0 0 0; } ' +
    '.ct-sb-logo { display: none !important; } .ct-sb-label { display: inline !important; }</style>';
  return html
    .replace('</head>', `${appHeaderStylesheet()}${layout}</head>`)
    .replace(/<body([^>]*)>/, (body) => `${body}${appHeaderMarkup()}`);
}

/**
 * Wraps a request handler: Storybook paths are served from `root`; everything else goes to `next`.
 *
 * - `isLocal(req)` says whether the request comes from this machine (the dev toolbar's
 *   `isLocalClient`); only then is the dev toolbar injected into index.html and served.
 * - `loadToolbar()` returns `{ js, css }`; defaults to ./swagger-toolbar.mjs (the same bundle the
 *   Swagger page uses), loaded on first use.
 * - `loadAppHeader()` returns `{ js, css }` for the site's header; defaults to
 *   ./app-header-assets.mjs.
 */
export function withStorybook(
  next,
  root,
  {
    isLocal = () => false,
    webRoot = process.cwd(),
    loadToolbar = async () => (await import('./swagger-toolbar.mjs')).toolbarAssets(webRoot),
    loadAppHeader = async () => (await import('./app-header-assets.mjs')).appHeaderAssets(webRoot),
  } = {}
) {
  const absRoot = path.resolve(root);
  return async (req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    const file = storybookFile(absRoot, urlPath);
    if (file === null) {
      return next(req, res);
    }
    // Relative asset URLs need the trailing slash.
    if (urlPath === STORYBOOK_PREFIX) {
      res.writeHead(308, { Location: `${STORYBOOK_PREFIX}/` });
      res.end();
      return undefined;
    }
    const headerAsset = [APP_HEADER_SCRIPT, APP_HEADER_STYLES].find((name) => file === path.join(absRoot, name));
    if (headerAsset !== undefined) {
      const assets = await loadAppHeader();
      const isScript = headerAsset === APP_HEADER_SCRIPT;
      res.writeHead(200, {
        'Content-Type': isScript ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(isScript ? assets.js : assets.css);
      return undefined;
    }
    const toolbarAsset = [TOOLBAR_SCRIPT, TOOLBAR_STYLES].find((name) => file === path.join(absRoot, name));
    if (toolbarAsset !== undefined && isLocal(req)) {
      const assets = await loadToolbar();
      const isScript = toolbarAsset === TOOLBAR_SCRIPT;
      res.writeHead(200, {
        'Content-Type': isScript ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(isScript ? assets.js : assets.css);
      return undefined;
    }
    const info = await stat(file).catch(() => null);
    if (info?.isFile() && file === path.join(absRoot, 'index.html')) {
      const html = withAppHeader(await readFile(file, 'utf8'));
      res.writeHead(200, { 'Content-Type': contentTypeOf(file), 'Cache-Control': 'no-store' });
      res.end(isLocal(req) ? withToolbar(html) : html);
      return undefined;
    }
    if (!info?.isFile()) {
      const built = await stat(path.join(absRoot, 'index.html')).catch(() => null);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        built
          ? 'Not found in the Storybook build.\n'
          : 'Storybook is not built yet. Run: pnpm -C apps/storybook run build\n'
      );
      return undefined;
    }
    res.writeHead(200, { 'Content-Type': contentTypeOf(file), 'Cache-Control': 'no-cache' });
    createReadStream(file).pipe(res);
    return undefined;
  };
}
