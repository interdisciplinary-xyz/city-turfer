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

test('globals.css declares a dark colour scheme, like the app', async () => {
  const css = await read('globals.css');
  assert.match(css, /color-scheme:\s*dark\s*;/);
  assert.doesNotMatch(css, /color-scheme:\s*light/);
});

test('the site uses the night wordmark; the branding page uses the site scheme', async () => {
  const files = [
    '[locale]/hero-copy/hero-copy.tsx',
    '[locale]/app-header/app-header.tsx',
    '[locale]/account/_portal/portal-header/portal-header.tsx',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /svg\/wordmark\.svg/, file);
    assert.doesNotMatch(source, /wordmark-light/, file);
  }
  const branding = await read('branding/page.dev.tsx');
  assert.match(branding, /cssVariables\(SITE_SCHEME\)/);
  assert.match(await read('branding/branding.css'), /color-scheme:\s*dark\s*;/);
});

test('pink and amber text go through the -text variables, never the raw fill', async () => {
  const css = await read('globals.css');
  assert.doesNotMatch(css, /[^-]color:\s*var\(--(glow|accent|strong|blazing)\)/);
});
