import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { appHeaderAssets, appHeaderMarkup } from '../../apps/web/tools/app-header-assets.mjs';

const WEB = path.resolve(import.meta.dirname, '../../apps/web');

test('bundles the site header and its stylesheet for the dev pages', async () => {
  const { js, css } = await appHeaderAssets(WEB);
  // The real component: its class names and the mount point are in the bundle.
  assert.match(js, /app-header-inner/);
  assert.match(js, /app-header-root/);
  // Logos are inlined, so the bundle needs no extra routes.
  assert.match(js, /data:image\/svg\+xml/);
  // No variable block: the header sets HEADER_SCHEME inline on itself (pinned in site-theme.test.mjs),
  // so a :root or .app-header block here would be dead CSS.
  assert.doesNotMatch(css, /^(\.app-header|:root) \{\n {2}--bg/m);
  // An opaque white bar (the header's --card) over the host page.
  assert.match(css, /#app-header-root \.app-header \{\n {2}background: var\(--card\);/);
  assert.match(css, /#app-header-root \{\n {2}display: contents;/);
});

test('the mount point is a plain root and the bundle script', () => {
  assert.equal(appHeaderMarkup(), '<div id="app-header-root"></div><script src="./__app-header.js"></script>');
});
