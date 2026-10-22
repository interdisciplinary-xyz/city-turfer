// The shared header sheet holds --header-h and the language switcher (.lang) the portal frame uses.
import '../app-header/app-header.css';
import './portal.css';

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { PortalApiProvider } from '@/api/provider';

import { PORTAL_CLIENT_NAMESPACES } from './layout.constants';

/**
 * The portal root (decision D3: `/[locale]/account`). Static shells only (D1): nothing personal is
 * rendered at build time; the data arrives in the browser after the session gate. This layout,
 * not the shared `[locale]/layout.tsx`, mounts the query client and the portal's copy, so the
 * landing page never loads either. Never indexed, never in the sitemap.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.meta' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
    // Not the landing page's canonical URL, languages or share card.
    alternates: null,
    openGraph: null,
    twitter: null,
  };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  const portalMessages = Object.fromEntries(
    PORTAL_CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]])
  );
  return (
    <NextIntlClientProvider messages={portalMessages}>
      <PortalApiProvider>{children}</PortalApiProvider>
    </NextIntlClientProvider>
  );
}
