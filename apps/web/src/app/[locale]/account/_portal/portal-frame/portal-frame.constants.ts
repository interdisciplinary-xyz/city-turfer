import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type PortalFrameProps = {
  locale: Locale;
  /** This page without the locale, for the language links. */
  path: string;
  headerActions?: ReactNode;
  /** The section links of signed-in pages (`PortalNav`); none on sign-in. */
  nav?: ReactNode;
  children: ReactNode;
};
