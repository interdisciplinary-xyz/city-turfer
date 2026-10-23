import type { Locale } from '@/i18n/routing';

export type LanguageSwitcherProps = {
  locale: Locale;
  className?: string;
  /** The page to link to in every language, without the locale (default: the landing page). */
  href?: string;
};
