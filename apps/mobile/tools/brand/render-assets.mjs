#!/usr/bin/env node
// Render CityTurfer brand sources into PNGs with headless Chrome (no npm dependencies):
//   - SVGs in packages/brand/svg → app icon, splash, favicon, wordmarks (assets/brand/out/)
//   - HTML templates in packages/brand/templates → social share image (apps/web/public/og-image.png)
//     and App Store / Play screenshots (assets/brand/out/store/)
//
//   node tools/brand/render-assets.mjs            # render everything
//   node tools/brand/render-assets.mjs --check    # only list what would be written
//   node tools/brand/render-assets.mjs store og   # only targets whose output path contains a word
//
// After changing outputs: icon/splash are native → reinstall needed (not OTA).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const BRAND = join(ROOT, '../../packages/brand/svg'); // @cityturfer/brand SVG sources
const TEMPLATES = join(ROOT, '../../packages/brand/templates');
const FONTS = join(ROOT, '../../packages/brand/fonts');
const SCREENS = join(ROOT, 'tools/brand/screens'); // app screenshots the OG and store templates frame (the site's hero now codes its screens)
const WEB_PUBLIC = join(ROOT, '../web/public');
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
  { src: 'wordmark.svg', out: 'wordmark.png', width: 898, height: 200, transparent: true },
  { src: 'wordmark-light.svg', out: 'wordmark-light.png', width: 898, height: 200, transparent: true },
  {
    template: 'og-image.html',
    out: join(WEB_PUBLIC, 'og-image.png'),
    width: 1200,
    height: 630,
    slots: {
      HEADLINE: 'Surf your city. Own your streets.',
      SUB: 'Every walk, run and ride claims the streets you cover. Your routes stay on your phone.',
      SCREEN: 'turf-map.jpg',
    },
  },
  // App Store 6.9" (1290×2796) and Google Play phone (1080×2340); same story, two sizes.
  ...[
    ['appstore', 1290, 2796],
    ['play', 1080, 2340],
  ].flatMap(([store, width, height]) => [
    {
      template: 'store-screenshot.html',
      out: `store/${store}-1-turf.png`,
      width,
      height,
      slots: {
        HEADLINE: 'Every street you cover becomes <em>yours</em>.',
        SUB: 'Your turf glows brighter each time you come back.',
        SCREEN: 'turf-map.jpg',
      },
    },
    {
      template: 'store-screenshot.html',
      out: `store/${store}-2-stats.png`,
      width,
      height,
      slots: {
        HEADLINE: 'Walk it. Run it. Ride it. <em>Own it.</em>',
        SUB: 'Distance, pace, splits and new turf from every outing.',
        SCREEN: 'dashboard.jpg',
      },
    },
  ]),
];

const MIME = { '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const dataUri = (file) => `data:${MIME[extname(file)]};base64,${readFileSync(file).toString('base64')}`;

/** Fill a template's {{SLOTS}}: fonts, logo and screenshots become data URIs (no network). */
function renderTemplate(t, w, h) {
  const slots = {
    W: String(w),
    H: String(h),
    FONT_DISPLAY: dataUri(join(FONTS, 'BigShouldersDisplay-Black.woff2')),
    FONT_BODY: dataUri(join(FONTS, 'Barlow-Medium.woff2')),
    FONT_TAGLINE: dataUri(join(FONTS, 'BarlowSemiCondensed-BlackItalic.woff2')),
    WORDMARK: dataUri(join(BRAND, 'wordmark.svg')),
    ...t.slots,
    SCREEN: dataUri(join(SCREENS, t.slots.SCREEN)),
  };
  const html = readFileSync(join(TEMPLATES, t.template), 'utf8').replace(/<!--[\s\S]*?-->/, '');
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in slots)) {
      throw new Error(`${t.template}: no value for {{${key}}}`);
    }
    return slots[key];
  });
}

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
const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const tmp = mkdtempSync(join(tmpdir(), 'brand-'));

for (const t of TARGETS) {
  const w = t.width ?? t.size;
  const h = t.height ?? t.size;
  const target = t.out.startsWith('/') ? t.out : join(OUT, t.out);
  if (filters.length && !filters.some((f) => target.includes(f))) {
    continue;
  }
  if (check) {
    console.log(`${target.replace(`${ROOT}/`, '')}  ${w}x${h}  ${t.src ?? t.template ?? t.solid}`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  const body = t.solid
    ? `<div style="width:${w}px;height:${h}px;background:${t.solid}"></div>`
    : t.template
      ? renderTemplate(t, w, h)
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
  console.log(`✔ ${target.replace(`${ROOT}/`, '')} (${w}x${h})`);
}
