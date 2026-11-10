import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ActivityPage } from '@/domains/activities';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  // Never the activity's name: titles end up in history and tab lists.
  return { title: t('activityTitle') };
}

/**
 * `/[locale]/account/activity?id=…` (H2): one page for every activity, since the static export
 * can't prerender one per id. The id is read in the browser (useSearchParams, so a Suspense
 * boundary: the export renders nothing for it).
 */
export default async function Activity({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <ActivityPage locale={locale} />
    </Suspense>
  );
}
