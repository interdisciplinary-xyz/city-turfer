// Dev only: bundled by swagger-toolbar.mjs into the script the Swagger and Storybook pages load.
// Mounts the website's dev toolbar outside Next with the same props as /en and /branding
// (DEV_TOOLBAR_PROPS), so the bar is identical on every page.
import { DevToolbar } from '@interdisciplinary/dev-toolbar/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { DEV_TOOLBAR_PROPS } from '../src/app/dev-toolbar-with-app/dev-toolbar-with-app.constants';

const host = document.getElementById('dev-toolbar-root');
if (host) {
  createRoot(host).render(createElement(DevToolbar, { ...DEV_TOOLBAR_PROPS, locale: DEV_TOOLBAR_PROPS.defaultLocale }));
}
