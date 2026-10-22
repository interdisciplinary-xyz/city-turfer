import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { checkExport, chunksOf } from '../check-export.mjs';

const NOINDEX = '<meta name="robots" content="noindex, nofollow"/>';

/** A tiny fake export: landing pages, portal pages and their chunks. */
function fakeExport({
  landingChunk = 'console.log(1)',
  portalChunk = 'h.set("CityTurfer-Client")',
  portalHead = NOINDEX,
  sitemap = '<loc>/en</loc>',
} = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ct-export-'));
  mkdirSync(path.join(dir, '_next/static/chunks'), { recursive: true });
  writeFileSync(path.join(dir, '_next/static/chunks/landing.js'), landingChunk);
  writeFileSync(path.join(dir, '_next/static/chunks/portal.js'), portalChunk);
  for (const locale of ['en', 'pl']) {
    writeFileSync(path.join(dir, `${locale}.html`), '<script src="/_next/static/chunks/landing.js"></script>');
    mkdirSync(path.join(dir, locale, 'account'), { recursive: true });
    const page = `<head>${portalHead}</head><script src="/_next/static/chunks/portal.js"></script>`;
    writeFileSync(path.join(dir, locale, 'account.html'), page);
    writeFileSync(path.join(dir, locale, 'account', 'sign-in.html'), page);
  }
  writeFileSync(path.join(dir, 'sitemap.xml'), sitemap);
  return dir;
}

function withExport(options, fn) {
  const dir = fakeExport(options);
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('chunksOf finds script, link and RSC references once each', () => {
  const html =
    '<script src="/_next/static/chunks/a.js"></script><link href="/_next/static/chunks/b.css"/>"/_next/static/chunks/a.js"';
  assert.deepEqual(chunksOf(html), ['/_next/static/chunks/a.js', '/_next/static/chunks/b.css']);
});

test('a clean export passes', () => {
  withExport({}, (dir) => assert.deepEqual(checkExport(dir), []));
});

test('portal code in a landing chunk fails', () => {
  withExport({ landingChunk: 'new Error("No QueryClient set, use QueryClientProvider to set one")' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /en\.html loads .*No QueryClient set/);
  });
});

test('a portal page without noindex fails', () => {
  withExport({ portalHead: '' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /account\.html is not noindex, nofollow/);
  });
});

test('GSAP on a portal page fails', () => {
  withExport({ portalChunk: 'h.set("CityTurfer-Client");/* GreenSock */' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /contains GSAP/);
  });
});

test('a portal page in the sitemap fails', () => {
  withExport({ sitemap: '<loc>https://x/en/account</loc>' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /sitemap\.xml lists a portal page/);
  });
});

test('the positive control: no API client marker anywhere fails', () => {
  withExport({ portalChunk: 'nothing here' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /the check would see nothing/);
  });
});
