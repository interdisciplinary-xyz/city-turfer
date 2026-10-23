import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { SignInPage } from '../_portal/sign-in-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return { title: t('registerTitle') };
}

/** `/[locale]/account/register`: "Create account", the same e-mail → 6-digit code flow as sign-in. */
export default async function Register({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInPage locale={locale} mode='register' />;
}
