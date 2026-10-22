import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type PortalHeaderProps = {
  locale: Locale;
  /** This page without the locale (`/account`, `/account/sign-in`): the language links keep it. */
  path: string;
  /** Right-hand actions, e.g. the sign-out button on signed-in pages. */
  actions?: ReactNode;
};
