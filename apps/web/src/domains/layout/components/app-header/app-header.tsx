import './app-header.css';

import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { SECTION_ANCHORS } from '@/domains/homepage/logic';
import { LanguageSwitcher } from '@/domains/ui';

import type { AppHeaderProps } from './app-header.constants';
import { AppHeaderView } from './app-header-view';
import { HeaderNavSync } from './header-nav-sync';

/** Sticky top bar, solid from the start: the logo on the left; on the right (on the landing page) the section links, then the language switcher. */
export function AppHeader({ locale, nav = false, waitlistSection = false }: AppHeaderProps) {
  const t = useTranslations('header');
  // Every linkable home section, in page order. Not linked: the hero (the logo goes to the top) and
  // the closing call to action (no anchor; it points at the waitlist).
  const anchors = [
    ...(waitlistSection ? ([['waitlist', SECTION_ANCHORS.waitlist]] as const) : []),
    ['how', SECTION_ANCHORS.how],
    ['who', SECTION_ANCHORS.who],
    ['app', SECTION_ANCHORS.app],
    ['privacy', SECTION_ANCHORS.privacy],
    ['faq', SECTION_ANCHORS.faq],
  ] as const;
  return (
    <>
      <AppHeaderView
        homeHref={`/${locale}`}
        homeLabel={t('home')}
        logo={
          <>
            {/* Eager: the header is on the first screen, so lazy loading only delays the logo. */}
            <Image className='app-header-mark' src={mark} alt='' width={32} height={32} loading='eager' />
            <Image className='app-header-wordmark' src={wordmark} alt='' width={90} height={20} loading='eager' />
          </>
        }
        nav={
          nav
            ? {
                label: t('nav.label'),
                items: anchors.map(([key, anchor]) => ({ href: `#${anchor}`, label: t(`nav.${key}`) })),
              }
            : null
        }
        languages={<LanguageSwitcher locale={locale} />}
      />
      {nav ? <HeaderNavSync /> : null}
    </>
  );
}
