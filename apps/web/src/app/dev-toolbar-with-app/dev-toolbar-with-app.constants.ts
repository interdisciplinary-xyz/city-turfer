import type { DevToolbarLink } from '@interdisciplinary/dev-toolbar/react';

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
