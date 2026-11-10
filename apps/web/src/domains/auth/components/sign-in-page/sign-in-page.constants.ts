import type { Locale } from '@/i18n/routing';
import type { AuthMode } from '@/lib/api/next-path';

export type SignInPageProps = {
  locale: Locale;
  /** `register` shows the "Create account" copy; the e-mailed-code flow is the same. */
  mode?: AuthMode;
};
