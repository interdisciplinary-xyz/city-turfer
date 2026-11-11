import { cssVariables, HEADER_SCHEME } from '@cityturfer/brand';
import type { CSSProperties, ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type AppHeaderProps = {
  locale: Locale;
  /** Section links on the right, before the language switcher (the landing page only). */
  nav?: boolean;
  /** Whether the page has the waitlist section (mirrors the WAITLIST settings): adds its link. */
  waitlistSection?: boolean;
};

/** The header's section links (the landing page): a labelled list of in-page anchors. */
export type AppHeaderNav = { label: string; items: { href: string; label: string }[] };

/** The header's markup without Next, shared by AppHeader and the dev pages outside Next. */
export type AppHeaderViewProps = {
  homeHref: string;
  homeLabel: string;
  /** The mark and wordmark images (next/image on the site, plain <img> on the dev pages). */
  logo: ReactNode;
  /** Section links, shown from 1024 px. Omit (or null) for none, as on the dev pages. */
  nav?: AppHeaderNav | null;
  /** The language switcher. */
  languages: ReactNode;
};

/** The header's own colours (HEADER_SCHEME, light), set on the <header> so they apply only inside it. */
export const HEADER_VARIABLES = cssVariables(HEADER_SCHEME) as CSSProperties;
