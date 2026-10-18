import '../globals.css';

import { DARK, NAME, ON_ACCENT, TIER_COLOR, TYPE_COLOR } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';

import { routing } from '@/i18n/routing';

import { SITE_URL } from '../site-url';
import { LanguageSwitcher } from './language-switcher';

/** Every language is prerendered by the static export. */
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    icons: { icon: mark.src, apple: mark.src },
    openGraph: { title: NAME, description: t('description'), type: 'website', locale },
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  };
}

export const viewport: Viewport = { themeColor: DARK.bg, colorScheme: 'dark' };

/** Brand tokens from @cityturfer/brand as CSS variables, so globals.css never hard-codes a hex. */
const tokens = {
  '--night': DARK.bg,
  '--night-raised': DARK.card,
  '--text': DARK.text,
  '--muted': DARK.muted,
  '--border': DARK.border,
  '--faint': TIER_COLOR.faint,
  '--glow': TIER_COLOR.glowing,
  '--on-glow': ON_ACCENT,
  '--strong': TIER_COLOR.strong,
  '--blazing': TIER_COLOR.blazing,
  '--walk': TYPE_COLOR.walk,
  '--run': TYPE_COLOR.run,
  '--ride': TYPE_COLOR.cycle,
} as CSSProperties;

export default async function LocaleLayout({
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

  // Dev toolbar: development build + a request from this machine only. Both imports are dynamic
  // and sit inside the NODE_ENV branch, which the production build compiles to `if (false)` and
  // drops, so neither the package, the adapter nor its CSS reaches the static export.
  let devToolbar: ReactNode = null;
  if (process.env.NODE_ENV === 'development') {
    const { shouldRenderDevToolbar } = await import('@interdisciplinary/dev-toolbar/next');
    if (await shouldRenderDevToolbar()) {
      const { DevToolbarWithApp } = await import('../dev-toolbar-with-app');
      devToolbar = <DevToolbarWithApp locale={locale} languageSwitcher={<LanguageSwitcher locale={locale} />} />;
    }
  }

  return (
    <html lang={locale} style={tokens}>
      <body>
        {/* next-intl's Link (language switcher, also slotted into the dev toolbar) is a client
            component and reads the locale from this provider. */}
        <NextIntlClientProvider>
          {children}
          {devToolbar}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
