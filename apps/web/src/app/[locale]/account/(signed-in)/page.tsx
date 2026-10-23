import { setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { PrivacyPage } from '../_portal/privacy-page';

/** `/[locale]/account`: Privacy & data, the portal home of Slice 0. */
export default async function AccountHome({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrivacyPage locale={locale} />;
}
