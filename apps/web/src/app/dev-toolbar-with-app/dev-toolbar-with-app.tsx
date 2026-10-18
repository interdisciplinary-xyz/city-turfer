'use client';

import './dev-toolbar.css';

import { NAME } from '@cityturfer/brand';
import { DevToolbar } from '@interdisciplinary/dev-toolbar/react';

import {
  DEV_TOOLBAR_LINKS,
  DEV_TOOLBAR_LOCALE,
  DEV_TOOLBAR_LOCALES,
  DEV_TOOLBAR_STORAGE_PREFIX,
} from './dev-toolbar-with-app.constants';

/**
 * App adapter for `@interdisciplinary/dev-toolbar`: hands the landing page's settings to the
 * package as props. No user (the site has no accounts), one locale.
 *
 * Loaded ONLY through a dynamic `import()` inside the layout's
 * `process.env.NODE_ENV === 'development'` branch, so a production build drops it, together with
 * the package and its CSS.
 */
export const DevToolbarWithApp = () => (
  <DevToolbar
    user={null}
    brandLabel={NAME}
    locale={DEV_TOOLBAR_LOCALE}
    locales={DEV_TOOLBAR_LOCALES}
    defaultLocale={DEV_TOOLBAR_LOCALE}
    links={DEV_TOOLBAR_LINKS}
    storagePrefix={DEV_TOOLBAR_STORAGE_PREFIX}
  />
);
