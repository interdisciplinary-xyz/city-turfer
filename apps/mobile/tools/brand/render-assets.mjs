#!/usr/bin/env node
// Render CityTurfer brand SVG sources (assets/brand/*.svg) into the PNGs the
// app needs, using headless Chrome (no npm dependencies).
//
//   node tools/brand/render-assets.mjs            # writes into assets/
//   node tools/brand/render-assets.mjs --check    # only list what would be written
//
// After changing outputs: icon/splash are native → reinstall needed (not OTA).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const BRAND = join(ROOT, '../../packages/brand/svg'); // @cityturfer/brand SVG sources
// Staged here; copy into assets/ only together with a native reinstall
// (icons are part of the runtime fingerprint, so OTA updates stop matching).
const OUT = join(ROOT, 'assets/brand/out');

// iOS icon must be opaque & full-bleed (iOS applies the mask). Android adaptive
// icons: foreground/monochrome transparent with art inside the 66% safe zone.
const TARGETS = [
  { src: 'mark.svg', out: 'icon.png', size: 1024, transparent: false },
  { src: 'mark-foreground.svg', out: 'android-icon-foreground.png', size: 1024, transparent: true },
  { src: 'mark-monochrome.svg', out: 'android-icon-monochrome.png', size: 1024, transparent: true },
  { solid: '#0B0D12', out: 'android-icon-background.png', size: 1024 },
  { src: 'mark-foreground.svg', out: 'splash-icon.png', size: 1024, transparent: true },
  { src: 'mark.svg', out: 'favicon.png', size: 64, transparent: false },
  { src: 'wordmark.svg', out: 'wordmark.png', width: 820, height: 260, transparent: true },
];

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error('Chrome not found. Install Google Chrome or set CHROME_PATH.');
  process.exit(1);
}

const check = process.argv.includes('--check');
const tmp = mkdtempSync(join(tmpdir(), 'brand-'));

for (const t of TARGETS) {
  const w = t.width ?? t.size;
  const h = t.height ?? t.size;
  const target = join(OUT, t.out);
  if (check) {
    console.log(`${t.out}  ${w}x${h}  ${t.src ?? t.solid}`);
    continue;
  }
  const body = t.solid
    ? `<div style="width:${w}px;height:${h}px;background:${t.solid}"></div>`
    : readFileSync(join(BRAND, t.src), 'utf8').replace(
        /<svg /,
        `<svg style="display:block;width:${w}px;height:${h}px" `
      );
  const html = join(tmp, `${t.out.replace(/\W/g, '_')}.html`);
  // 200px padding above + taller window: the art sits in the vertical centre, so
  // sips' centred crop (it ignores --cropOffset) cuts exactly w×h around it.
  writeFileSync(
    html,
    `<!doctype html><html><body style="margin:0;padding-top:200px;background:transparent">${body}</body></html>`
  );
  // Headless Chrome's viewport is shorter than --window-size, so render into a
  // taller window and crop the centred w×h with sips.
  const shot = join(tmp, 'shot.png');
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${w},${h + 400}`,
      `--screenshot=${shot}`,
      ...(t.transparent ? ['--default-background-color=00000000'] : []),
      `file://${html}`,
    ],
    { stdio: 'ignore' }
  );
  execFileSync('sips', ['-c', String(h), String(w), shot, '--out', target], { stdio: 'ignore' });
  console.log(`✔ ${t.out} (${w}x${h})`);
}
