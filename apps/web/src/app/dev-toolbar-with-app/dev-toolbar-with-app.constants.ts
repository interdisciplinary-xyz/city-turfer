import type { DevToolbarLink } from '@interdisciplinary/dev-toolbar/react';

/** Namespace for the toolbar's localStorage / sessionStorage keys. */
export const DEV_TOOLBAR_STORAGE_PREFIX = 'cityturfer';

/** The landing page is English only for now. */
export const DEV_TOOLBAR_LOCALE = 'en';
export const DEV_TOOLBAR_LOCALES = ['en'] as const;

/** Quick links in the toolbar's action row (opened in a new tab). */
export const DEV_TOOLBAR_LINKS: readonly DevToolbarLink[] = [
  { label: 'GitHub', href: 'https://github.com/interdisciplinary-xyz/city-turfer' },
  { label: 'Pull requests', href: 'https://github.com/interdisciplinary-xyz/city-turfer/pulls' },
  { label: 'Vercel', href: 'https://vercel.com/micha-dopieralskis-projects' },
];
