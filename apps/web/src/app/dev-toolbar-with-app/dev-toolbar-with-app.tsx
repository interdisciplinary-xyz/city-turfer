'use client';

import './dev-toolbar.css';

import { NAME } from '@cityturfer/brand';
import { DevToolbar } from '@interdisciplinary/dev-toolbar/react';

import { routing } from '@/i18n/routing';

import {
  DEV_TOOLBAR_LINKS,
  DEV_TOOLBAR_STORAGE_PREFIX,
  type DevToolbarWithAppProps,
} from './dev-toolbar-with-app.constants';

/**
 * App adapter for `@interdisciplinary/dev-toolbar`: hands the landing page's settings to the
 * package as props. No user (the site has no accounts); languages from the next-intl routing.
 *
 * Loaded ONLY through a dynamic `import()` inside the layout's
 * `process.env.NODE_ENV === 'development'` branch, so a production build drops it, together with
 * the package and its CSS.
 */
export const DevToolbarWithApp = ({ locale }: DevToolbarWithAppProps) => (
  <DevToolbar
    user={null}
    brandLabel={NAME}
    locale={locale}
    locales={routing.locales}
    defaultLocale={routing.defaultLocale}
    links={DEV_TOOLBAR_LINKS}
    storagePrefix={DEV_TOOLBAR_STORAGE_PREFIX}
    // The site makes no API calls of its own, so the API logger row has nothing to show.
    requestLogger={false}
  />
);
