import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { PORTAL_ROOT } from '@/api/next-path';
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
  return (
    <SessionGate locale={locale} path={PORTAL_ROOT}>
      {children}
    </SessionGate>
  );
}
