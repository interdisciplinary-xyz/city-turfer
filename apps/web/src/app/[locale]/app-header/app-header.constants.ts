import type { Locale } from '@/i18n/routing';

export type AppHeaderProps = {
  locale: Locale;
  /** Whether the waitlist section exists on the page (mirrors the WAITLIST settings). */
  waitlist: boolean;
};
