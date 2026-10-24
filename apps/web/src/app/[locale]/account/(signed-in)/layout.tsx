import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { routing } from '@/i18n/routing';

import { SessionGate } from '../_portal/session-gate';

/** Every signed-in page sits behind the client session gate (`GET /v1/me`, 401 → sign-in). */
export default async function SignedInLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <SessionGate locale={locale}>{children}</SessionGate>;
}
