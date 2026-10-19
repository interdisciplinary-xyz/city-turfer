// Dev only: serves the design system's static Storybook build at /storybook on the local site
// (https://cityturfer.local/storybook), so it sits next to the landing page it documents.
//
// The static build (`pnpm -C apps/storybook run build` → apps/storybook/storybook-static) uses
// relative URLs, so it works under a sub-path. Storybook's live dev server doesn't (it loads
// from the site root), so live editing stays on http://localhost:6006.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

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

/**
 * Wraps a request handler: Storybook paths are served from `root`; everything else goes to `next`.
 */
export function withStorybook(next, root) {
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
    const info = await stat(file).catch(() => null);
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
