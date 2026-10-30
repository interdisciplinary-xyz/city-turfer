import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const SRC = path.resolve(import.meta.dirname, '../../src/app');
const read = (file) => readFile(path.join(SRC, file), 'utf8');

test('the layout takes its scheme from WEB_SCHEME, never a literal', async () => {
  const layout = await read('[locale]/layout.tsx');
  assert.match(layout, /cssVariables\(WEB_SCHEME\)/);
  assert.match(layout, /themeColor:\s*THEMES\[WEB_SCHEME\]\.card/);
  assert.match(layout, /colorScheme:\s*WEB_SCHEME/);
  assert.doesNotMatch(layout, /cssVariables\(['"]/);
  assert.doesNotMatch(layout, /\bDARK\b/);
});

test('globals.css declares a light colour scheme (WEB_SCHEME)', async () => {
  const css = await read('globals.css');
  assert.match(css, /color-scheme:\s*light\s*;/);
  assert.doesNotMatch(css, /color-scheme:\s*dark/);
});

test('the hero phones keep the dark app scheme on the light page', async () => {
  const constants = await read('[locale]/hero-screens/hero-screens.constants.ts');
  assert.match(constants, /cssVariables\(APP_SCHEME\)/);
  assert.match(await read('[locale]/hero-screens/hero-screens.tsx'), /className='phone' style=\{PHONE_VARIABLES\}/);
});

test('the light site and its white header use the day wordmark; the branding page uses the site scheme', async () => {
  const files = [
    '[locale]/hero-copy/hero-copy.tsx',
    '[locale]/app-header/app-header.tsx',
    '[locale]/account/_portal/portal-header/portal-header.tsx',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /svg\/wordmark-light\.svg/, file);
    assert.doesNotMatch(source, /svg\/wordmark\.svg/, file);
  }
  // The dev header (Storybook, Swagger) uses the same day wordmark.
  const entry = await readFile(path.resolve(import.meta.dirname, '../app-header-entry.mjs'), 'utf8');
  assert.match(entry, /svg\/wordmark-light\.svg/);
  assert.doesNotMatch(entry, /svg\/wordmark\.svg/);
  const branding = await read('branding/page.dev.tsx');
  assert.match(branding, /cssVariables\(SITE_SCHEME\)/);
  assert.match(await read('branding/branding.css'), /color-scheme:\s*dark\s*;/);
});

test('the header sets its own light scheme inline, from HEADER_SCHEME', async () => {
  const view = await read('[locale]/app-header/app-header-view.tsx');
  assert.match(view, /<header className='app-header' style=\{HEADER_VARIABLES\}>/);
  const constants = await read('[locale]/app-header/app-header.constants.ts');
  assert.match(constants, /cssVariables\(HEADER_SCHEME\)/);
  assert.match(await read('[locale]/app-header/app-header.css'), /\.app-header \{[^}]*background:\s*var\(--card\)/);
  assert.match(await read('[locale]/account/portal.css'), /\.portal-header \{[^}]*background:\s*var\(--card\)/);
});

test('the pieces that draw turf tiers are night panels from APP_SCHEME', async () => {
  const constants = await read('[locale]/home-sections/home-sections.constants.ts');
  assert.match(constants, /cssVariables\(APP_SCHEME\)/);
  const tsx = await read('[locale]/home-sections/home-sections.tsx');
  for (const piece of ['app-record', 'app-gain', 'app-legend', 'home-dashboard']) {
    assert.match(tsx, new RegExp(`className='${piece}' style=\\{APP_VARIABLES\\}`), piece);
  }
});

test('pink and amber text go through the -text variables, never the raw fill', async () => {
  for (const file of ['globals.css', '[locale]/home-sections/home-sections.css', '[locale]/account/portal.css']) {
    const css = await read(file);
    assert.doesNotMatch(css, /[^-]color:\s*var\(--(glow|accent|strong|blazing)\)/, file);
  }
});
