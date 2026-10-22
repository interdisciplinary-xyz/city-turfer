// Run with `node --experimental-strip-types --test` (the constants are TypeScript).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  LOADER_BOOT_SCRIPT,
  LOADER_MAX_MS,
  LOADER_SHOW_MS,
  PAGE_LOADED_CLASS,
  PAGE_LOADED_EVENT,
} from '../../src/app/[locale]/page-loader/page-loader.constants.ts';

/** A stub browser: classList, timers and listeners we can fire by hand. */
function setup({
  readyState = 'loading',
  fonts = Promise.resolve(),
  withFonts = true,
  reducedMotion = false,
  navType = 'navigate',
  throwOnMatchMedia = false,
} = {}) {
  const classes = new Set();
  const events = [];
  const timers = [];
  const domListeners = [];
  const document = {
    documentElement: { classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) } },
    readyState,
    addEventListener: (type, fn) => type === 'DOMContentLoaded' && domListeners.push(fn),
    ...(withFonts ? { fonts: { ready: fonts } } : {}),
  };
  const window = {
    dispatchEvent: (e) => events.push(e.type),
    performance: { getEntriesByType: () => [{ type: navType }] },
    matchMedia: () => {
      if (throwOnMatchMedia) {
        throw new Error('boom');
      }
      return { matches: reducedMotion };
    },
  };
  const run = (code) =>
    new Function('document', 'window', 'performance', 'matchMedia', 'setTimeout', 'Event', 'Promise', code)(
      document,
      window,
      window.performance,
      window.matchMedia,
      (fn, ms) => timers.push({ fn, ms }),
      class {
        constructor(type) {
          this.type = type;
        }
      },
      Promise
    );
  return { classes, events, timers, domListeners, run };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const timer = (env, ms) => env.timers.find((t) => t.ms === ms);

test('boot script: a fast page never shows the loader, and fires the event once', async () => {
  const env = setup();
  env.run(LOADER_BOOT_SCRIPT);
  assert.ok(!env.classes.has('loader-active'));
  env.domListeners.forEach((fn) => fn());
  await tick();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);

  // Neither the show timer nor the cap firing afterwards changes anything.
  timer(env, LOADER_SHOW_MS).fn();
  timer(env, LOADER_MAX_MS).fn();
  assert.ok(!env.classes.has('loader-active'));
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);
});

test('boot script: a slow page shows the loader after the threshold, then releases it', async () => {
  const env = setup({ fonts: new Promise(() => {}) });
  env.run(LOADER_BOOT_SCRIPT);
  await tick();
  assert.ok(LOADER_SHOW_MS >= 150 && LOADER_SHOW_MS <= 200);
  assert.ok(!env.classes.has('loader-active'));
  timer(env, LOADER_SHOW_MS).fn();
  assert.ok(env.classes.has('loader-active'));
  assert.ok(!env.classes.has(PAGE_LOADED_CLASS));
  timer(env, LOADER_MAX_MS).fn();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);
});

test('boot script: reduced motion skips the loader and is loaded at once', () => {
  const env = setup({ reducedMotion: true });
  env.run(LOADER_BOOT_SCRIPT);
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.ok(!env.classes.has('loader-active'));
  assert.equal(env.timers.length, 0);
});

test('boot script: back/forward and reload skip the loader', () => {
  for (const navType of ['back_forward', 'reload']) {
    const env = setup({ navType });
    env.run(LOADER_BOOT_SCRIPT);
    assert.ok(env.classes.has(PAGE_LOADED_CLASS), navType);
    assert.ok(!env.classes.has('loader-active'), navType);
  }
});

test('boot script: does not wait for window.load (already parsed) and works without document.fonts', async () => {
  const env = setup({ readyState: 'complete', withFonts: false });
  env.run(LOADER_BOOT_SCRIPT);
  await tick();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
});

test('boot script: an error still marks the page loaded', () => {
  const env = setup({ throwOnMatchMedia: true });
  env.run(LOADER_BOOT_SCRIPT);
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.ok(!env.classes.has('loader-active'));
});

test('CSS: the loader is hidden by default and only shown under loader-active, which `loaded` overrides', () => {
  const css = readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.page-loader \{[^}]*opacity: 0;[^}]*visibility: hidden;/s);
  const active = css.indexOf('.loader-active .page-loader');
  const loaded = css.indexOf('.loaded .page-loader');
  assert.ok(active > 0 && loaded > active, '`loaded` must come after `loader-active`');
});
