import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import { checkExport, chunksOf, PORTAL_COPY_MARKER, portalLinksOf } from '../check-export.mjs';

const NOINDEX = '<meta name="robots" content="noindex, nofollow"/>';
const SCRIPT = path.resolve(import.meta.dirname, '../check-export.mjs');

/** The two chunk layouts: `next build` locally, and Vercel's build step. */
const CHUNK_DIRS = ['_next/static/chunks', '_next/static/immutable/chunks'];

/** Writes a tiny fake export into `dir`: landing pages, portal pages and their chunks. */
function writeFakeExport(
  dir,
  {
    chunkDir = '_next/static/chunks',
    landingChunk = 'console.log(1)',
    landingHtml = '',
    portalChunk = 'h.set("CityTurfer-Client")',
    portalHead = NOINDEX,
    sitemap = '<loc>/en</loc>',
  } = {}
) {
  mkdirSync(path.join(dir, chunkDir), { recursive: true });
  writeFileSync(path.join(dir, chunkDir, 'landing.js'), landingChunk);
  writeFileSync(path.join(dir, chunkDir, 'portal.js'), portalChunk);
  for (const locale of ['en', 'pl']) {
    writeFileSync(path.join(dir, `${locale}.html`), `<script src="/${chunkDir}/landing.js"></script>${landingHtml}`);
    mkdirSync(path.join(dir, locale, 'account'), { recursive: true });
    const page = `<head>${portalHead}</head><script src="/${chunkDir}/portal.js"></script>`;
    writeFileSync(path.join(dir, locale, 'account.html'), page);
    writeFileSync(path.join(dir, locale, 'account', 'sign-in.html'), page);
  }
  writeFileSync(path.join(dir, 'sitemap.xml'), sitemap);
  return dir;
}

function fakeExport(options) {
  return writeFakeExport(mkdtempSync(path.join(tmpdir(), 'ct-export-')), options);
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

test('chunksOf also finds immutable chunks (Vercel build)', () => {
  const html = '<script src="/_next/static/immutable/chunks/a.js"></script>';
  assert.deepEqual(chunksOf(html), ['/_next/static/immutable/chunks/a.js']);
});

test('chunksOf finds nested, percent-encoded chunks and stops at an escaped quote (RSC payload)', () => {
  const html =
    '<script src="/_next/static/chunks/app/%5Blocale%5D/page-1a.js"></script>' +
    '\\"/_next/static/immutable/chunks/app/%5Blocale%5D/account/page-2b.js\\"' +
    "url('/_next/static/chunks/c.css')";
  assert.deepEqual(chunksOf(html), [
    '/_next/static/chunks/app/%5Blocale%5D/page-1a.js',
    '/_next/static/immutable/chunks/app/%5Blocale%5D/account/page-2b.js',
    '/_next/static/chunks/c.css',
  ]);
});

for (const chunkDir of CHUNK_DIRS) {
  describe(`chunks under ${chunkDir}`, () => {
    test('a clean export passes', () => {
      withExport({ chunkDir }, (dir) => assert.deepEqual(checkExport(dir), []));
    });

    test('portal code in a landing chunk fails', () => {
      withExport(
        { chunkDir, landingChunk: 'new Error("No QueryClient set, use QueryClientProvider to set one")' },
        (dir) => {
          assert.match(checkExport(dir).join('\n'), /en\.html loads .*No QueryClient set/);
        }
      );
    });

    test('GSAP on a portal page fails', () => {
      withExport({ chunkDir, portalChunk: 'h.set("CityTurfer-Client");/* GreenSock */' }, (dir) => {
        assert.match(checkExport(dir).join('\n'), /contains GSAP/);
      });
    });

    test('the positive control: no API client marker anywhere fails', () => {
      withExport({ chunkDir, portalChunk: 'nothing here' }, (dir) => {
        assert.match(checkExport(dir).join('\n'), /the check would see nothing/);
      });
    });
  });
}

test('a nested, encoded chunk is read from its decoded path on disk', () => {
  withExport({}, (dir) => {
    const ref = '/_next/static/chunks/app/%5Blocale%5D/page-1a.js';
    mkdirSync(path.join(dir, '_next/static/chunks/app/[locale]'), { recursive: true });
    writeFileSync(path.join(dir, '_next/static/chunks/app/[locale]/page-1a.js'), 'fetch(x,{querySerializer})');
    writeFileSync(path.join(dir, 'en.html'), `<script src="${ref}"></script>`);
    const findings = checkExport(dir).join('\n');
    assert.match(findings, /en\.html loads .*page-1a\.js, which contains portal code \(querySerializer\)/);
    assert.doesNotMatch(findings, /not found/);
  });
});

test('portal copy in the landing HTML fails', () => {
  withExport({ landingHtml: `<script>self.__next_f.push(["${PORTAL_COPY_MARKER}"])</script>` }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /en\.html carries portal copy/);
  });
});

test('/api/v1 in the landing HTML fails', () => {
  withExport({ landingHtml: '<link rel="preconnect" href="/api/v1/me"/>' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /en\.html mentions \/api\/v1/);
  });
});

test('/api/v1 in a landing chunk fails', () => {
  withExport({ landingChunk: 'fetch("/api/v1/activities")' }, (dir) => {
    assert.match(
      checkExport(dir).join('\n'),
      /en\.html loads \/_next\/static\/chunks\/landing\.js, which mentions \/api\/v1/
    );
  });
});

test('portal copy or /api/v1 in a landing RSC payload fails; the portal payload is not read', () => {
  withExport({}, (dir) => {
    writeFileSync(path.join(dir, 'en.txt'), `0:["${PORTAL_COPY_MARKER}"]`);
    writeFileSync(path.join(dir, 'pl', '__next.$d$locale.__PAGE__.txt'), '1:"/api/v1/me"');
    writeFileSync(path.join(dir, 'pl', 'account.txt'), `0:["${PORTAL_COPY_MARKER}","/api/v1/me"]`);
    assert.deepEqual(checkExport(dir), [
      'en.txt carries portal copy',
      `${path.join('pl', '__next.$d$locale.__PAGE__.txt')} mentions /api/v1`,
    ]);
  });
});

test('a missing landing page fails', () => {
  withExport({}, (dir) => {
    rmSync(path.join(dir, 'pl.html'));
    assert.deepEqual(checkExport(dir), ['missing landing page pl.html']);
  });
});

test('an export without portal pages fails', () => {
  withExport({}, (dir) => {
    for (const locale of ['en', 'pl']) {
      rmSync(path.join(dir, locale), { recursive: true });
    }
    assert.deepEqual(checkExport(dir), ['no portal pages found under out/<locale>/account']);
  });
});

test('portalLinksOf finds account links of any locale, without query or fragment', () => {
  const html =
    '<a href="/en/account/sign-in">x</a><a href="/en/account/register?next=%2Fen">y</a>' +
    '<a href="/pl/account/">z</a><a href="/en/accounting">no</a><a href="/de/account">no</a>';
  assert.deepEqual(portalLinksOf(html, ['en', 'pl']), ['/en/account/sign-in', '/en/account/register', '/pl/account']);
});

test('a landing link to an exported portal page passes', () => {
  withExport({ landingHtml: '<a href="/en/account/sign-in">Sign in</a><a href="/en/account">x</a>' }, (dir) => {
    assert.deepEqual(checkExport(dir), []);
  });
});

test('a landing link to a portal page that was not exported fails', () => {
  withExport({ landingHtml: '<a href="/en/account/register">Create account</a>' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /en\.html links to \/en\/account\/register, which is not in the export/);
  });
});

test('a portal page without noindex fails', () => {
  withExport({ portalHead: '' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /account\.html is not noindex, nofollow/);
  });
});

test('a portal page in the sitemap fails', () => {
  withExport({ sitemap: '<loc>https://x/en/account</loc>' }, (dir) => {
    assert.match(checkExport(dir).join('\n'), /sitemap\.xml lists a portal page/);
  });
});

test('chunks moved out of out/ are read from .next/static (Vercel build step)', () => {
  for (const chunkDir of CHUNK_DIRS) {
    withExport({ chunkDir }, (dir) => {
      const nextDir = path.join(dir, '.next-moved');
      const moved = path.join(nextDir, chunkDir.replace(/^_next\//, ''));
      mkdirSync(path.dirname(moved), { recursive: true });
      renameSync(path.join(dir, chunkDir), moved);
      assert.deepEqual(checkExport(dir, { nextDir }), []);
    });
  }
});

test('a chunk found nowhere is a finding, not an empty file', () => {
  withExport({}, (dir) => {
    rmSync(path.join(dir, '_next'), { recursive: true });
    const findings = checkExport(dir, { nextDir: path.join(dir, 'no-such-dir') }).join('\n');
    assert.match(findings, /chunk \/_next\/static\/chunks\/landing\.js not found/);
    assert.match(findings, /chunk \/_next\/static\/chunks\/portal\.js not found/);
  });
});

test('a page that references no chunks is a finding', () => {
  withExport({}, (dir) => {
    writeFileSync(path.join(dir, 'en.html'), '<p>no scripts</p>');
    assert.match(checkExport(dir).join('\n'), /en\.html references no chunks/);
  });
});

// The script the build runs (`node tools/check-export.mjs`), not just checkExport(): its main-module
// guard must fire in a path with a space and through a symlinked checkout, or the gate fails open.
describe('the CLI the build runs', () => {
  /** A checkout-like tree `<tmp>/web app/{tools/check-export.mjs,out/}` plus a symlink to it. */
  function withCheckout(options, fn) {
    const root = mkdtempSync(path.join(tmpdir(), 'ct-export-cli-'));
    try {
      const app = path.join(root, 'web app');
      mkdirSync(path.join(app, 'tools'), { recursive: true });
      copyFileSync(SCRIPT, path.join(app, 'tools/check-export.mjs'));
      writeFakeExport(path.join(app, 'out'), options);
      const link = path.join(root, 'linked');
      symlinkSync(app, link, 'dir');
      fn({ spaced: path.join(app, 'tools/check-export.mjs'), linked: path.join(link, 'tools/check-export.mjs') });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const run = (script) => spawnSync(process.execPath, [script], { encoding: 'utf8' });

  for (const via of ['spaced', 'linked']) {
    test(`exits 1 on a broken export (${via} path)`, () => {
      withCheckout({ landingChunk: 'h.set("CityTurfer-Client")' }, (paths) => {
        const result = run(paths[via]);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /Public\/portal boundary broken/);
      });
    });

    test(`exits 0 on a clean export (${via} path)`, () => {
      withCheckout({}, (paths) => {
        const result = run(paths[via]);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /Export check: landing pages load no portal code/);
      });
    });
  }
});
