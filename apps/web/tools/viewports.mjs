#!/usr/bin/env node
/**
 * Render the landing page at several viewport sizes with headless Chrome and save PNGs, for a
 * quick responsive / visual check (no browser automation library needed).
 *
 *   node apps/web/tools/viewports.mjs [--url https://cityturfer.local] [--paths /en,/pl]
 *        [--sizes 320x640,375x812,768x1024,844x390,1440x900] [--out /tmp/viewports]
 *        [--reduced-motion] [--wait 4000]
 *
 * Headless Chrome cannot shrink its window below ~500 px, so every size is rendered inside an
 * iframe of exactly that size on a tiny local host page. Self-signed dev certificates (portless)
 * are accepted. Prints the PNG paths.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Async on purpose: this process also serves the host page Chrome loads.
const run = promisify(execFile);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'https://cityturfer.local').replace(/\/$/, '');
const paths = arg('paths', '/en').split(',');
const sizes = arg('sizes', '320x640,375x812,768x1024,844x390,1440x900')
  .split(',')
  .map((s) => s.split('x').map(Number));
const out = arg('out', join(tmpdir(), 'cityturfer-viewports'));
const wait = Number(arg('wait', '4000'));
const reducedMotion = process.argv.includes('--reduced-motion');

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error('Chrome not found. Install Google Chrome or set CHROME_PATH.');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

let page = '';
const server = createServer((_, res) => res.end(page)).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const host = `http://127.0.0.1:${server.address().port}/`;

for (const path of paths) {
  for (const [w, h] of sizes) {
    page = `<!doctype html><body style="margin:0;background:#000"><iframe src="${url}${path}" width="${w}" height="${h}" style="border:0;display:block"></iframe></body>`;
    const file = join(out, `${path.replace(/\W+/g, '') || 'root'}-${w}x${h}${reducedMotion ? '-reduced' : ''}.png`);
    await run(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--ignore-certificate-errors',
        `--window-size=${Math.max(w, 500)},${h}`,
        `--virtual-time-budget=${wait}`,
        ...(reducedMotion ? ['--force-prefers-reduced-motion'] : []),
        `--screenshot=${file}`,
        host,
      ],
      { timeout: wait + 30000 }
    );
    console.log(file);
  }
}
server.close();
writeFileSync(join(out, '.done'), new Date().toISOString());
