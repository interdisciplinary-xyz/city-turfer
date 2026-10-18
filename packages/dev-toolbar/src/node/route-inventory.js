/**
 * Dev-only route inventory for the dev toolbar's route map ("which routes
 * have we visited, and what did each one request?").
 *
 * Returns the two raw ingredients; the toolbar turns them into the
 * checklist (see `buildRouteInventory` in `../react/utils/route-inventory`):
 *
 *   - `sitemapPaths`  every URL in our own `/sitemap.xml` — each CMS page,
 *                     blog post and style page, per locale
 *   - `filePatterns`  every `page.tsx` under the host app's `appDir`, as a
 *                     locale-less route pattern (`/app/team/[teamId]`) —
 *                     catches the authenticated / unlisted routes the
 *                     sitemap leaves out
 */
import { readdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const isRouteGroup = (name) => name.startsWith('(') && name.endsWith(')');

/**
 * @param {string} dir
 * @param {string} localeSegment
 * @param {string[]} [segments]
 * @returns {Promise<string[]>}
 */
async function collectPagePatterns(dir, localeSegment, segments = []) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === 'page.tsx') {
      found.push(`/${segments.join('/')}`);
      continue;
    }
    // `_private` folders and `@parallel` slots are not URL segments.
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('@')) {
      continue;
    }
    // Route groups and the locale segment (`[locale]`) don't appear in the
    // pattern; locale prefixes are matched separately by the toolbar.
    const skip = isRouteGroup(entry.name) || entry.name === localeSegment;
    found.push(
      ...(await collectPagePatterns(
        path.join(dir, entry.name),
        localeSegment,
        skip ? segments : [...segments, entry.name]
      ))
    );
  }
  return found;
}

const SITEMAP_TIMEOUT_MS = 30_000;

/**
 * GET our own sitemap over plain `node:http`, NOT the global `fetch`: by the
 * time this runs Next has patched `fetch` for its data cache, and calling
 * the patched one outside a request's render scope hung the endpoint.
 */
function getOwnSitemap(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/sitemap.xml' }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`/sitemap.xml answered ${res.statusCode}`));
        return;
      }
      let xml = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        xml += chunk;
      });
      res.on('end', () => resolve(xml));
      res.on('error', reject);
    });
    req.setTimeout(SITEMAP_TIMEOUT_MS, () => {
      req.destroy(new Error('/sitemap.xml timed out'));
    });
    req.on('error', reject);
  });
}

async function readSitemapPaths(port) {
  const xml = await getOwnSitemap(port);
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc.trim()).pathname);
}

/**
 * @param {number} port
 * @param {{ appDir: string; localeSegment: string }} options
 */
export async function readRouteInventory(port, { appDir, localeSegment }) {
  const [filePatterns, sitemapPaths] = await Promise.all([
    collectPagePatterns(appDir, localeSegment),
    readSitemapPaths(port),
  ]);
  return {
    sitemapPaths: [...new Set(sitemapPaths)].sort(),
    filePatterns: [...new Set(filePatterns)].sort(),
  };
}
