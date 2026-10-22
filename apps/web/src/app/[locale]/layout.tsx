import '../globals.css';

import { cssVariables, DARK, NAME } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';

import { routing } from '@/i18n/routing';

import { displayFont, numericFont } from '../fonts';
import { SITE_URL } from '../site-url';
import { MOTION_BOOT_SCRIPT } from './hero-motion';
import { OG_IMAGE_HEIGHT, OG_IMAGE_PATH, OG_IMAGE_WIDTH } from './layout.constants';

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
    openGraph: {
      title: NAME,
      description: t('description'),
      type: 'website',
      locale,
      images: [
        { url: new URL(OG_IMAGE_PATH, SITE_URL).href, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: t('ogAlt') },
      ],
    },
    twitter: { card: 'summary_large_image', title: NAME, description: t('description') },
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  };
}

export const viewport: Viewport = { themeColor: DARK.bg, colorScheme: 'dark' };

/** Design tokens from @cityturfer/brand as CSS variables, so globals.css never hard-codes a value.
 * The site is always dark, like the Turf Map. */
const tokens = cssVariables('dark') as CSSProperties;

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
      devToolbar = <DevToolbarWithApp locale={locale} />;
    }
  }

  return (
    // suppressHydrationWarning: the motion boot script adds a class to <html> before React hydrates.
    <html
      lang={locale}
      className={`${displayFont.variable} ${numericFont.variable}`}
      style={tokens}
      suppressHydrationWarning
    >
      <head>
        {/* Before first paint: hide [data-anim] for the entrance animation (skipped with reduced motion). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
      </head>
      <body>
        {/* next-intl's Link (language switcher) is a client component and reads the locale from
            this provider. */}
        <NextIntlClientProvider>
          {children}
          {devToolbar}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
