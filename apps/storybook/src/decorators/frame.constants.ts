import type { ReactNode } from 'react';

import en from '../../../web/messages/en.json';
import pl from '../../../web/messages/pl.json';

export type Locale = 'en' | 'pl';

export type FrameProps = {
  locale: Locale;
  /** Website stories: they get the page-loaded class below. Same scheme (SITE_SCHEME) as every story. */
  web?: boolean;
  /** Website stories: mark the page as loaded (the site's boot script does this) so the entrance plays. */
  pageLoaded?: boolean;
  children: ReactNode;
};

export type NightPanelProps = {
  children: ReactNode;
};

/** The website's copy (apps/web/messages), the same files next-intl loads there. */
export const MESSAGES: Record<Locale, typeof en> = { en, pl };
