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
export function checkExport(outDir, { locales = ['en', 'pl'], nextDir = path.join(outDir, '..', '.next') } = {}) {
  const findings = [];
  const read = (file) => readFileSync(file, 'utf8');
  const missing = new Set();
  // A chunk is read from the export, else from Next's build folder (Vercel's build step can move
  // out/_next away). A chunk found in neither is a finding: reading it as empty would pass silently.
  const chunk = (ref) => {
    const candidates = [path.join(outDir, ref), path.join(nextDir, ref.replace(/^\/_next\//, ''))];
    const file = candidates.find((candidate) => existsSync(candidate));
    if (!file) {
      if (!missing.has(ref)) {
        missing.add(ref);
        findings.push(`chunk ${ref} not found in out/ or .next/: the check cannot read it`);
      }
      return '';
    }
    return read(file);
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
    // Say what was read, so a failure on a build machine can be diagnosed from its log alone.
    const seen = pages.map((file) => `${rel(file)}: ${chunksOf(read(file)).length} chunk refs`).join('; ');
    const scripts = [...read(pages[0]).matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].slice(0, 3).map((m) => m[1]);
    const nextOut = path.join(outDir, '_next');
    const layout = existsSync(nextOut)
      ? walk(nextOut)
          .slice(0, 3)
          .map((file) => path.relative(outDir, file))
      : [];
    findings.push(
      `diagnostics: first scripts ${scripts.join(', ') || 'none'}; out/_next files ${layout.join(', ') || 'none'}`
    );
    const chunkDir = [path.join(outDir, '_next/static/chunks'), path.join(nextDir, 'static/chunks')].find((dir) =>
      existsSync(dir)
    );
    const holders = chunkDir
      ? walk(chunkDir)
          .filter((file) => file.endsWith('.js') && read(file).includes(PORTAL_MARKERS[0]))
          .map((file) => path.basename(file))
      : [];
    findings.push(
      `no portal page loads the API client marker (${PORTAL_MARKERS[0]}): the check would see nothing ` +
        `[${seen}; chunks holding it: ${holders.join(', ') || 'none'} in ${chunkDir ?? 'no chunk folder'}]`
    );
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
