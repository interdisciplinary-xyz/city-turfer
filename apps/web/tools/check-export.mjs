#!/usr/bin/env node
// Checks the static export (apps/web/out) keeps the public/portal boundary (`web-portal` skill):
// - the landing pages (/en, /pl) load no chunk with the API client, TanStack Query, openapi-fetch,
//   maplibre-gl or portal code, carry no portal copy and no /api/v1 call;
// - every portal page is noindex, nofollow and loads no GSAP chunk;
// - the sitemap lists no portal page.
// Runs after every `next build` (package.json "build"); exits 1 with the findings.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Strings that only the portal's bundles contain (also checked to be present there: a positive control). */
export const PORTAL_MARKERS = [
  'CityTurfer-Client', // src/api/client.ts
  'No QueryClient set', // @tanstack/react-query
  'querySerializer', // openapi-fetch
  'maplibregl', // maplibre-gl (Slice 1)
];

/** A portal message key: portal copy must not ride along in the landing page's payload. */
export const PORTAL_COPY_MARKER = 'sharedComputerHint';

/** GSAP's own banner and warnings. */
export const GSAP_MARKERS = ['GreenSock', 'gsap.registerPlugin'];

const CHUNK = /\/_next\/static\/chunks\/[A-Za-z0-9_~.-]+?\.(?:js|css)/g;

/** Every chunk a page references, in its HTML (script tags, preloads and the inline RSC payload). */
export function chunksOf(html) {
  return [...new Set(html.match(CHUNK) ?? [])];
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** The portal's HTML pages: out/<locale>/account.html and everything under out/<locale>/account/. */
export function portalPages(outDir, locales) {
  return locales.flatMap((locale) => {
    const home = path.join(outDir, locale, 'account.html');
    const below = path.join(outDir, locale, 'account');
    return [
      ...(existsSync(home) ? [home] : []),
      ...(existsSync(below) ? walk(below).filter((file) => file.endsWith('.html')) : []),
    ];
  });
}

/** Returns a list of findings (empty = the boundary holds). */
export function checkExport(outDir, { locales = ['en', 'pl'] } = {}) {
  const findings = [];
  const read = (file) => readFileSync(file, 'utf8');
  const chunk = (ref) => {
    const file = path.join(outDir, ref);
    return existsSync(file) ? read(file) : '';
  };
  const rel = (file) => path.relative(outDir, file);

  for (const locale of locales) {
    const file = path.join(outDir, `${locale}.html`);
    if (!existsSync(file)) {
      findings.push(`missing landing page ${locale}.html`);
      continue;
    }
    const html = read(file);
    if (html.includes(PORTAL_COPY_MARKER)) {
      findings.push(`${locale}.html carries portal copy`);
    }
    if (html.includes('/api/v1')) {
      findings.push(`${locale}.html mentions /api/v1`);
    }
    for (const ref of chunksOf(html)) {
      const body = chunk(ref);
      for (const marker of PORTAL_MARKERS) {
        if (body.includes(marker)) {
          findings.push(`${locale}.html loads ${ref}, which contains portal code (${marker})`);
        }
      }
    }
  }

  const pages = portalPages(outDir, locales);
  if (pages.length === 0) {
    findings.push('no portal pages found under out/<locale>/account');
  }
  let markerSeen = false;
  for (const file of pages) {
    const html = read(file);
    if (!/<meta name="robots" content="noindex, nofollow"\s*\/?>/.test(html)) {
      findings.push(`${rel(file)} is not noindex, nofollow`);
    }
    for (const ref of chunksOf(html)) {
      const body = chunk(ref);
      if (body.includes(PORTAL_MARKERS[0])) {
        markerSeen = true;
      }
      for (const marker of GSAP_MARKERS) {
        if (body.includes(marker)) {
          findings.push(`${rel(file)} loads ${ref}, which contains GSAP (${marker})`);
        }
      }
    }
  }
  if (pages.length > 0 && !markerSeen) {
    findings.push(`no portal page loads the API client marker (${PORTAL_MARKERS[0]}): the check would see nothing`);
  }

  const sitemap = path.join(outDir, 'sitemap.xml');
  if (existsSync(sitemap) && read(sitemap).includes('/account')) {
    findings.push('sitemap.xml lists a portal page');
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = path.resolve(import.meta.dirname, '../out');
  const findings = checkExport(outDir);
  if (findings.length > 0) {
    console.error(`Public/portal boundary broken in ${outDir}:\n- ${findings.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Export check: landing pages load no portal code; portal pages are noindex and GSAP-free.');
}
