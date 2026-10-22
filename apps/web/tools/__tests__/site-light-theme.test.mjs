import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const SRC = path.resolve(import.meta.dirname, '../../src/app');
const read = (file) => readFile(path.join(SRC, file), 'utf8');

test('the layout takes its scheme from SITE_SCHEME, never a literal', async () => {
  const layout = await read('[locale]/layout.tsx');
  assert.match(layout, /cssVariables\(SITE_SCHEME\)/);
  assert.match(layout, /themeColor:\s*THEMES\[SITE_SCHEME\]\.bg/);
  assert.match(layout, /colorScheme:\s*SITE_SCHEME/);
  assert.doesNotMatch(layout, /cssVariables\(['"]/);
  assert.doesNotMatch(layout, /\bDARK\b/);
});

test('globals.css declares a light colour scheme', async () => {
  const css = await read('globals.css');
  assert.match(css, /color-scheme:\s*light\s*;/);
  assert.doesNotMatch(css, /color-scheme:\s*dark/);
});

test('the site uses the light wordmark; the branding page uses the site scheme', async () => {
  for (const file of ['[locale]/hero-copy/hero-copy.tsx', '[locale]/app-header/app-header.tsx']) {
    assert.match(await read(file), /svg\/wordmark-light\.svg/, file);
  }
  const branding = await read('branding/page.dev.tsx');
  assert.match(branding, /cssVariables\(SITE_SCHEME\)/);
  assert.match(await read('branding/branding.css'), /color-scheme:\s*light\s*;/);
});

test('raw glow is never used as text on the light page', async () => {
  const css = await read('globals.css');
  assert.doesNotMatch(css, /[^-]color:\s*var\(--(glow|accent|strong|blazing)\)/);
});
