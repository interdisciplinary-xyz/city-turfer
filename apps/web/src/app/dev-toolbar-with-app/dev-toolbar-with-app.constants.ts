import { NAME } from '@cityturfer/brand';
import type { DevToolbarLink, DevToolbarProps } from '@interdisciplinary/dev-toolbar/react';

import { routing } from '@/i18n/routing';

/** Namespace for the toolbar's localStorage / sessionStorage keys. */
export const DEV_TOOLBAR_STORAGE_PREFIX = 'cityturfer';

export type DevToolbarWithAppProps = {
  /** The page's language (`[locale]` segment); pages outside it (/branding) omit it. */
  locale?: string;
};

/** Quick links in the toolbar's action row (opened in a new tab). */
export const DEV_TOOLBAR_LINKS: readonly DevToolbarLink[] = [
  // Served by server.mjs on the same origin (pnpm run web:dev).
  { label: 'Swagger', href: '/swagger' },
  { label: 'Storybook', href: '/storybook' },
  // The brand definition page (src/app/branding), served by the site itself.
  { label: 'Branding', href: '/branding' },
  { label: 'GitHub', href: 'https://github.com/interdisciplinary-xyz/city-turfer' },
  { label: 'Pull requests', href: 'https://github.com/interdisciplinary-xyz/city-turfer/pulls' },
  { label: 'Vercel', href: 'https://vercel.com/micha-dopieralskis-projects' },
];

/**
 * Everything but the locale, shared by every page that shows the toolbar: the site (/en, /branding)
 * through `DevToolbarWithApp`, and Storybook and Swagger through `tools/swagger-toolbar-entry.mjs`,
 * so the bar looks the same everywhere. Only the DEV row: there is no API logger for now.
 */
export const DEV_TOOLBAR_PROPS = {
  user: null,
  brandLabel: NAME,
  locales: routing.locales,
  defaultLocale: routing.defaultLocale,
  links: DEV_TOOLBAR_LINKS,
  storagePrefix: DEV_TOOLBAR_STORAGE_PREFIX,
  requestLogger: false,
} as const satisfies Omit<DevToolbarProps, 'locale'>;
