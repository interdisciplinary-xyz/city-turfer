import type { DevToolbarLink } from '@interdisciplinary/dev-toolbar/react';
import type { ReactNode } from 'react';

/** Namespace for the toolbar's localStorage / sessionStorage keys. */
export const DEV_TOOLBAR_STORAGE_PREFIX = 'cityturfer';

export type DevToolbarWithAppProps = {
  /** The page's language (`[locale]` segment). */
  locale: string;
  /** The landing page's language switcher, rendered by the server layout and slotted in. */
  languageSwitcher?: ReactNode;
};

/** Quick links in the toolbar's action row (opened in a new tab). */
export const DEV_TOOLBAR_LINKS: readonly DevToolbarLink[] = [
  // The brand definition page (src/app/branding), served by the site itself.
  { label: 'Branding', href: '/branding' },
  { label: 'GitHub', href: 'https://github.com/interdisciplinary-xyz/city-turfer' },
  { label: 'Pull requests', href: 'https://github.com/interdisciplinary-xyz/city-turfer/pulls' },
  { label: 'Vercel', href: 'https://vercel.com/micha-dopieralskis-projects' },
];
