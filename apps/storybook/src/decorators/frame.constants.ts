import type { ColorScheme } from '@cityturfer/brand';
import type { ReactNode } from 'react';

import en from '../../../web/messages/en.json';
import pl from '../../../web/messages/pl.json';

export type Locale = 'en' | 'pl';

export type FrameProps = {
  scheme: ColorScheme;
  locale: Locale;
  /** Website stories: the site is always dark, whatever the toolbar says. */
  web?: boolean;
  children: ReactNode;
};

/** The website's copy (apps/web/messages), the same files next-intl loads there. */
export const MESSAGES: Record<Locale, typeof en> = { en, pl };
