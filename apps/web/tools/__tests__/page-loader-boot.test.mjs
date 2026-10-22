// Run with `node --experimental-strip-types --test` (the constants are TypeScript).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  INERT_ROOT_SCRIPT,
  LOADER_BOOT_SCRIPT,
  LOADER_CSS_FALLBACK_S,
  LOADER_MAX_MS,
  PAGE_LOADED_CLASS,
  PAGE_LOADED_EVENT,
  PAGE_ROOT_ID,
} from '../../src/app/[locale]/page-loader/page-loader.constants.ts';

/** A stub browser: classList, a page root, timers and listeners we can fire by hand. */
function setup({ readyState = 'loading', fonts = Promise.resolve(), withFonts = true, throwOnClass = false } = {}) {
  const classes = new Set();
  const root = { inert: false };
  const events = [];
  const timers = [];
  const domListeners = [];
  const documentElement = {
    classList: {
      add: (c) => {
        if (throwOnClass && c === 'loader-active') {
          throw new Error('boom');
        }
        classes.add(c);
      },
      contains: (c) => classes.has(c),
    },
  };
  const document = {
    documentElement,
    readyState,
    getElementById: (id) => (id === PAGE_ROOT_ID ? root : null),
    addEventListener: (type, fn) => type === 'DOMContentLoaded' && domListeners.push(fn),
    currentScript: { parentElement: root },
    ...(withFonts ? { fonts: { ready: fonts } } : {}),
  };
  const window = { dispatchEvent: (e) => events.push(e.type) };
  const run = (code) =>
    new Function('document', 'window', 'setTimeout', 'Event', 'Promise', code)(
      document,
      window,
      (fn, ms) => timers.push({ fn, ms }),
      class {
        constructor(type) {
          this.type = type;
        }
      },
      Promise
    );
  return { classes, root, events, timers, domListeners, run };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('boot script: fades out once parsed and fonts ready, fires the event once, lifts inert', async () => {
  const env = setup();
  env.run(LOADER_BOOT_SCRIPT);
  assert.ok(env.classes.has('loader-active'));
  assert.ok(!env.classes.has(PAGE_LOADED_CLASS));
  env.run(INERT_ROOT_SCRIPT);
  assert.equal(env.root.inert, true);

  env.domListeners.forEach((fn) => fn());
  await tick();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.equal(env.root.inert, false);
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);

  // The cap timer firing afterwards must not fire the event again.
  env.timers[0].fn();
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);
});

test('boot script: does not wait for window.load (already parsed)', async () => {
  const env = setup({ readyState: 'interactive' });
  env.run(LOADER_BOOT_SCRIPT);
  await tick();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);
});

test('boot script: the cap timeout finishes the loader if fonts never resolve', () => {
  const env = setup({ fonts: new Promise(() => {}) });
  env.run(LOADER_BOOT_SCRIPT);
  assert.equal(env.timers.length, 1);
  assert.equal(env.timers[0].ms, LOADER_MAX_MS);
  env.run(INERT_ROOT_SCRIPT);
  assert.equal(env.root.inert, true);
  env.timers[0].fn();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.equal(env.root.inert, false);
  assert.deepEqual(env.events, [PAGE_LOADED_EVENT]);
});

test('boot script: works without document.fonts', async () => {
  const env = setup({ readyState: 'complete', withFonts: false });
  env.run(LOADER_BOOT_SCRIPT);
  await tick();
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
});

test('boot script: the catch path still marks the page loaded and never leaves it inert', () => {
  const env = setup({ throwOnClass: true });
  env.run(LOADER_BOOT_SCRIPT);
  assert.ok(env.classes.has(PAGE_LOADED_CLASS));
  assert.equal(env.root.inert, false);
  env.run(INERT_ROOT_SCRIPT);
  assert.equal(env.root.inert, false);
});

test('inert script: does nothing without the boot script or after the page loaded', () => {
  const none = setup();
  none.run(INERT_ROOT_SCRIPT);
  assert.equal(none.root.inert, false);

  const late = setup();
  late.run(LOADER_BOOT_SCRIPT);
  late.timers[0].fn();
  late.run(INERT_ROOT_SCRIPT);
  assert.equal(late.root.inert, false);
});

test('CSS fallback delay matches LOADER_CSS_FALLBACK_S and is longer than the cap', () => {
  const css = readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');
  const match = css.match(/animation:\s*page-loader-out\s+[\d.]+s\s+ease-out\s+([\d.]+)s\s+forwards/);
  assert.ok(match, 'page-loader-out animation not found');
  assert.equal(Number(match[1]), LOADER_CSS_FALLBACK_S);
  assert.ok(LOADER_CSS_FALLBACK_S * 1000 > LOADER_MAX_MS);
});
