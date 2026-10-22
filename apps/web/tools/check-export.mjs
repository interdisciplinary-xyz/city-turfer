#!/usr/bin/env node
// Checks the static export (apps/web/out) keeps the public/portal boundary
// (docs/decisions/web-portal-2026-10-22.md):
// - the landing pages (/en, /pl) load no chunk with the API client, TanStack Query, openapi-fetch,
//   maplibre-gl or portal code, carry no portal copy and no /api/v1 call (in the HTML, a chunk or
//   the RSC payloads the language switcher fetches: <locale>.txt, <locale>/__next.*.txt);
// - every portal page is noindex, nofollow and loads no GSAP chunk;
// - the sitemap lists no portal page.
// Runs after every `next build` (package.json "build"); exits 1 with the findings.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

// Flat (Turbopack) and nested, percent-encoded (webpack: app/%5Blocale%5D/page-….js) chunk paths.
const CHUNK = /\/_next\/static\/(?:immutable\/)?chunks\/[^"'\s\\)]+?\.(?:js|css)/g;

/** Every chunk a page references, in its HTML (script tags, preloads and the inline RSC payload). */
export function chunksOf(html) {
  return [...new Set(html.match(CHUNK) ?? [])];
}

function decoded(ref) {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
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

/** The landing page's soft-navigation RSC payloads: out/<locale>.txt and out/<locale>/__next.*.txt. */
export function landingPayloads(outDir, locale) {
  const top = path.join(outDir, `${locale}.txt`);
  const below = path.join(outDir, locale);
  return [
    ...(existsSync(top) ? [top] : []),
    ...(existsSync(below)
      ? readdirSync(below)
          .filter((name) => /^__next\..*\.txt$/.test(name))
          .map((name) => path.join(below, name))
      : []),
  ];
}

/** Returns a list of findings (empty = the boundary holds). */
export function checkExport(outDir, { locales = ['en', 'pl'], nextDir = path.join(outDir, '..', '.next') } = {}) {
  const findings = [];
  const read = (file) => readFileSync(file, 'utf8');
  const missing = new Set();
  // A chunk is read from the export, else from Next's build folder (Vercel's build step can move
  // out/_next away). A chunk found in neither is a finding: reading it as empty would pass silently.
  // The URL is percent-encoded (%5Blocale%5D); the file on disk is not ([locale]).
  const chunk = (ref) => {
    const refs = [...new Set([ref, decoded(ref)])];
    const candidates = refs.flatMap((r) => [path.join(outDir, r), path.join(nextDir, r.replace(/^\/_next\//, ''))]);
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
    for (const payload of landingPayloads(outDir, locale)) {
      const text = read(payload);
      if (text.includes(PORTAL_COPY_MARKER)) {
        findings.push(`${rel(payload)} carries portal copy`);
      }
      if (text.includes('/api/v1')) {
        findings.push(`${rel(payload)} mentions /api/v1`);
      }
    }
    if (chunksOf(html).length === 0) {
      findings.push(`${rel(file)} references no chunks: the check would see nothing`);
    }
    for (const ref of chunksOf(html)) {
      const body = chunk(ref);
      for (const marker of PORTAL_MARKERS) {
        if (body.includes(marker)) {
          findings.push(`${locale}.html loads ${ref}, which contains portal code (${marker})`);
        }
      }
      if (body.includes('/api/v1')) {
        findings.push(`${locale}.html loads ${ref}, which mentions /api/v1`);
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
    if (chunksOf(html).length === 0) {
      findings.push(`${rel(file)} references no chunks: the check would see nothing`);
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
    const chunkDir = [
      path.join(outDir, '_next/static/immutable/chunks'),
      path.join(outDir, '_next/static/chunks'),
      path.join(nextDir, 'static/immutable/chunks'),
      path.join(nextDir, 'static/chunks'),
    ].find((dir) => existsSync(dir));
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

/** True when Node runs this file as the script. Compares real paths as file URLs: argv[1] is neither
 * realpath'd nor percent-encoded, so a symlinked checkout or a path with a space would otherwise
 * skip the check and exit 0 (tools/__tests__/check-export.test.mjs spawns it both ways). */
function isMain() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
}

if (isMain()) {
  const outDir = path.resolve(import.meta.dirname, '../out');
  const findings = checkExport(outDir);
  if (findings.length > 0) {
    console.error(`Public/portal boundary broken in ${outDir}:\n- ${findings.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Export check: landing pages load no portal code; portal pages are noindex and GSAP-free.');
}
