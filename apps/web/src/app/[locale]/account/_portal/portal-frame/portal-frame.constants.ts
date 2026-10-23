import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type PortalFrameProps = {
  locale: Locale;
  /** This page without the locale, for the language links. */
  path: string;
  headerActions?: ReactNode;
  children: ReactNode;
};
