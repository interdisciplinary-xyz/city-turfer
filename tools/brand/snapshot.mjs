#!/usr/bin/env node
/**
 * `pnpm run brand:snapshot`: screenshot every surface in tools/brand/surfaces.mjs that has a URL
 * (website, portal, /branding, both Swaggers, Storybook) at phone and desktop width, plus the booted
 * iOS Simulator, and write one contact sheet (index.html) to compare them side by side. Use it
 * before and after a branding change (the `brand-surfaces` skill).
 *
 *   pnpm run brand:snapshot                          every surface that answers
 *   pnpm run brand:snapshot -- --only web,swagger-api
 *   pnpm run brand:snapshot -- --out /path/to/dir --wait 6000
 *   pnpm run brand:snapshot -- --web https://cityturfer.local --api http://localhost:8787
 *
 * Needs `pnpm run web:dev` for the web surfaces (Storybook under /storybook needs a static build)
 * and `pnpm --filter @cityturfer/api dev` for the API's Swagger; a surface that does not answer is
 * listed as skipped, never captured as an error page. The simulator is captured only when one is
 * booted, as it is (navigate to the screen first). Screenshots stay local: the app's screens can
 * show routes, so never upload or commit them (CLAUDE.md, location data is personal data).
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { SURFACES } from './surfaces.mjs';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const VIEWPORTS = join(ROOT, 'apps/web/tools/viewports.mjs');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = resolve(arg('out', join(tmpdir(), `cityturfer-brand-${stamp}`)));
const bases = { web: arg('web', 'https://cityturfer.local'), api: arg('api', 'http://localhost:8787') };
const only = arg('only', '').split(',').filter(Boolean);
const wait = arg('wait', '4000');

/** HTTP status of a URL (self-signed dev certificates accepted), or 0 when nothing answers. */
async function status(url) {
  try {
    const { stdout } = await run('curl', ['-sk', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', url]);
    return Number(stdout);
  } catch {
    return 0;
  }
}

/** True when the page refuses to sit in a frame (viewports.mjs renders every size in an iframe). */
async function refusesFrames(url) {
  try {
    const { stdout } = await run('curl', ['-skI', '--max-time', '5', url]);
    return /^x-frame-options:/im.test(stdout) || /^content-security-policy:.*frame-ancestors/im.test(stdout);
  } catch {
    return false;
  }
}

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].find((p) => p && existsSync(p));

/**
 * Direct capture for pages that refuse frames: headless Chrome's window is at least 500 px wide,
 * so phone sizes come out at 500 px (the caption says so).
 */
async function captureDirect(url, sizes, dir) {
  const files = [];
  for (const size of sizes) {
    const [w, h] = size.split('x').map(Number);
    const width = Math.max(w, 500);
    const file = join(dir, `${new URL(url).pathname.replace(/\W+/g, '') || 'root'}-${width}x${h}-direct.png`);
    await run(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--ignore-certificate-errors',
        // Reduced motion: the page loader and the hero entrance never hide the page in a still.
        '--force-prefers-reduced-motion',
        `--window-size=${width},${h}`,
        `--virtual-time-budget=${wait}`,
        `--screenshot=${file}`,
        url,
      ],
      { timeout: Number(wait) + 30000 }
    );
    files.push(file);
  }
  return files;
}

async function bootedSimulator() {
  try {
    const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
    return Object.values(JSON.parse(stdout).devices).flat()[0] ?? null;
  } catch {
    return null;
  }
}

if (!existsSync(VIEWPORTS)) {
  console.error(`missing ${relative(ROOT, VIEWPORTS)}: the web surfaces are captured with it`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const rows = [];

for (const s of SURFACES.filter((x) => x.snapshot && (only.length === 0 || only.includes(x.id)))) {
  const dir = join(out, s.id);
  if ('ios' in s.snapshot) {
    const device = await bootedSimulator();
    if (!device) {
      rows.push({ s, skipped: 'no booted iOS Simulator' });
      continue;
    }
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'ios-simulator.png');
    await run('xcrun', ['simctl', 'io', 'booted', 'screenshot', file]);
    rows.push({ s, files: [file], detail: device.name });
    continue;
  }
  const base = bases[s.snapshot.base].replace(/\/$/, '');
  const probe = await status(`${base}${s.snapshot.paths[0]}`);
  if (probe === 0 || probe >= 400) {
    rows.push({ s, skipped: `${base}${s.snapshot.paths[0]} answered ${probe || 'nothing'}` });
    continue;
  }
  mkdirSync(dir, { recursive: true });
  if (await refusesFrames(`${base}${s.snapshot.paths[0]}`)) {
    if (!CHROME) {
      rows.push({ s, skipped: 'refuses frames and Chrome was not found (set CHROME_PATH)' });
      continue;
    }
    const files = [];
    for (const p of s.snapshot.paths) {
      files.push(...(await captureDirect(`${base}${p}`, s.snapshot.sizes, dir)));
    }
    rows.push({ s, files, detail: `${base} (refuses frames: captured directly, at least 500 px wide)` });
    continue;
  }
  await run(
    process.execPath,
    [
      VIEWPORTS,
      '--url',
      base,
      '--paths',
      s.snapshot.paths.join(','),
      '--sizes',
      s.snapshot.sizes.join(','),
      '--out',
      dir,
      '--wait',
      wait,
      // Brand stills compare the static look: skip the loader and the entrance (they caught the
      // landing page behind its loader before).
      '--reduced-motion',
    ],
    { timeout: 300000 }
  );
  rows.push({
    s,
    files: readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => join(dir, f)),
    detail: base,
  });
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const section = ({ s, files, skipped, detail }) => `
<section>
  <h2>${esc(s.name)} <small>${esc(s.id)} · ${s.scheme} · ${s.status} · owner ${esc(s.owner)}${detail ? ` · ${esc(detail)}` : ''}</small></h2>
  ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
  ${skipped ? `<p class="skip">Skipped: ${esc(skipped)}</p>` : `<div class="shots">${files.map((f) => `<figure><img src="${esc(relative(out, f))}" loading="lazy"><figcaption>${esc(relative(out, f))}</figcaption></figure>`).join('')}</div>`}
</section>`;

// A neutral sheet on purpose: it must not tint what it compares.
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Brand surfaces ${stamp}</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; background: #808080; color: #000; }
  section { background: #fff; padding: 16px; margin-bottom: 24px; border-radius: 8px; }
  h2 small { font-weight: 400; color: #555; } .note { color: #555; } .skip { color: #a00; }
  .shots { display: flex; gap: 16px; align-items: flex-start; overflow-x: auto; }
  figure { margin: 0; } img { max-height: 70vh; border: 1px solid #ccc; display: block; }
  figcaption { font-size: 12px; color: #555; }
</style>
<h1>Brand surfaces · ${stamp}</h1>
${rows.map(section).join('\n')}`
);

for (const r of rows) {
  console.log(`${r.skipped ? 'skip' : 'ok  '} ${r.s.id.padEnd(12)} ${r.skipped ?? `${r.files.length} image(s)`}`);
}
console.log(join(out, 'index.html'));
