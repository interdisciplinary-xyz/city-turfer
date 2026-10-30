import { cssVariables, HEADER_SCHEME } from '@cityturfer/brand';
import type { CSSProperties, ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type AppHeaderProps = {
  locale: Locale;
  /** Whether the waitlist section exists on the page (mirrors the WAITLIST settings). */
  waitlist: boolean;
  /** Where "Join the waitlist" goes: the section on the home page, `/<locale>#waitlist` elsewhere. */
  waitlistHref?: string;
};

/** The header's markup without Next, shared by AppHeader and the dev pages outside Next. */
export type AppHeaderViewProps = {
  homeHref: string;
  homeLabel: string;
  /** The mark and wordmark images (next/image on the site, plain <img> on the dev pages). */
  logo: ReactNode;
  waitlist: { href: string; label: string; shortLabel: string } | null;
  /** The language switcher. */
  languages: ReactNode;
};

/** The header's own colours (HEADER_SCHEME, light), set on the <header> so they apply only inside it. */
export const HEADER_VARIABLES = cssVariables(HEADER_SCHEME) as CSSProperties;
