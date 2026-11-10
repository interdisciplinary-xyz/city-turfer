import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SignInPage } from '@/domains/auth';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return { title: t('signInTitle') };
}

/** `/[locale]/account/sign-in`: e-mail → 6-digit code. */
export default async function SignIn({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInPage locale={locale} />;
}
