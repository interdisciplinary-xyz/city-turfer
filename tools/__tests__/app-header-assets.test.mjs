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
  // The website's (light) brand variables only on the header, then app-header.css itself.
  const { cssVariables, SITE_SCHEME } = await loadBrand(WEB);
  assert.equal(SITE_SCHEME, 'light');
  assert.match(css, /^\.app-header \{\n {2}--bg: /);
  assert.ok(css.includes(`--bg: ${cssVariables(SITE_SCHEME).bg ?? cssVariables(SITE_SCHEME)['--bg']};`));
  assert.doesNotMatch(css, /^:root \{\n {2}--bg/m);
  assert.match(css, /\.app-header\[data-scrolled\]/);
  assert.match(css, /#app-header-root \{\n {2}display: contents;/);
});

test('the mount point names the page lockup, escaped', () => {
  assert.equal(appHeaderMarkup(), '<div id="app-header-root"></div><script src="./__app-header.js"></script>');
  assert.match(appHeaderMarkup({ lockup: '.a[x="1"]' }), /data-lockup="\.a\[x=&quot;1&quot;\]"/);
});
