import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { appHeaderAssets, appHeaderMarkup } from '../../apps/web/tools/app-header-assets.mjs';
import { loadBrand } from '../../apps/web/tools/swagger-brand.mjs';

const WEB = path.resolve(import.meta.dirname, '../../apps/web');

test('bundles the site header and its stylesheet for the dev pages', async () => {
  const { js, css } = await appHeaderAssets(WEB);
  // The real component: its class names and the mount point are in the bundle.
  assert.match(js, /app-header-inner/);
  assert.match(js, /app-header-root/);
  // Logos are inlined, so the bundle needs no extra routes.
  assert.match(js, /data:image\/svg\+xml/);
  // The site scheme's brand variables only on the header, then app-header.css itself. Which scheme
  // that is, is pinned once, in packages/brand/src/__tests__/tokens.test.ts.
  const { cssVariables, SITE_SCHEME } = await loadBrand(WEB);
  assert.match(css, /^\.app-header \{\n {2}--bg: /);
  assert.ok(css.includes(`--bg: ${cssVariables(SITE_SCHEME).bg ?? cssVariables(SITE_SCHEME)['--bg']};`));
  assert.doesNotMatch(css, /^:root \{\n {2}--bg/m);
  // An opaque bar over the host page.
  assert.match(css, /#app-header-root \.app-header \{\n {2}background: var\(--bg\);/);
  assert.match(css, /#app-header-root \{\n {2}display: contents;/);
});

test('the mount point is a plain root and the bundle script', () => {
  assert.equal(appHeaderMarkup(), '<div id="app-header-root"></div><script src="./__app-header.js"></script>');
});
