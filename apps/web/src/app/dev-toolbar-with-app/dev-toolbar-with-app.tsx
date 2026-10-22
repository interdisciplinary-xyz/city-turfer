'use client';

import './dev-toolbar.css';

import { DevToolbar } from '@interdisciplinary/dev-toolbar/react';

import { routing } from '@/i18n/routing';

import { DEV_TOOLBAR_PROPS, type DevToolbarWithAppProps } from './dev-toolbar-with-app.constants';

/**
 * App adapter for `@interdisciplinary/dev-toolbar`: hands the landing page's settings to the
 * package as props (`DEV_TOOLBAR_PROPS`, shared with Storybook and Swagger).
 *
 * Loaded ONLY through a dynamic `import()` inside the layout's
 * `process.env.NODE_ENV === 'development'` branch, so a production build drops it, together with
 * the package and its CSS.
 */
export const DevToolbarWithApp = ({ locale = routing.defaultLocale }: DevToolbarWithAppProps) => (
  <DevToolbar {...DEV_TOOLBAR_PROPS} locale={locale} />
);
