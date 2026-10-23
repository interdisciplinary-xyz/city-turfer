import type { AuthMode } from '@/api/next-path';
import type { Locale } from '@/i18n/routing';

export type SignInPageProps = {
  locale: Locale;
  /** `register` shows the "Create account" copy; the e-mailed-code flow is the same. */
  mode?: AuthMode;
};
