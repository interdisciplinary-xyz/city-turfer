import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type AppHeaderProps = {
  locale: Locale;
  /** Whether the waitlist section exists on the page (mirrors the WAITLIST settings). */
  waitlist: boolean;
  /** Where "Join the waitlist" goes: the section on the home page, `/<locale>#waitlist` elsewhere. */
  waitlistHref?: string;
  /** The page's own logo; the header's logo shows once it has scrolled away (none: at once). */
  lockupSelector?: string;
  /** Show "Sign in" and "Create account" (the web portal). Default true. */
  account?: boolean;
};

/** A plain link in the header. */
export type AppHeaderLink = { href: string; label: string };

/** The header's markup without Next, shared by AppHeader and the dev pages outside Next. */
export type AppHeaderViewProps = {
  homeHref: string;
  homeLabel: string;
  /** The mark and wordmark images (next/image on the site, plain <img> on the dev pages). */
  logo: ReactNode;
  waitlist: { href: string; label: string; shortLabel: string } | null;
  /**
   * The portal's entry points. Plain links: the landing page stays static, makes no API call and
   * can't know whether anyone is signed in (the session cookie is HttpOnly).
   */
  account: { signIn: AppHeaderLink; register: AppHeaderLink } | null;
  /** The language switcher. */
  languages: ReactNode;
  lockupSelector?: string;
};
