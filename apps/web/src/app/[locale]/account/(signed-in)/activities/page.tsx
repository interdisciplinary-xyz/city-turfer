import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { ActivitiesPage } from '../../_portal/activities-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return { title: t('activitiesTitle') };
}

/** `/[locale]/account/activities`: the backed-up activities (docs/plans/web-portal-history-2026-10-23.md). */
export default async function Activities({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ActivitiesPage locale={locale} />;
}
