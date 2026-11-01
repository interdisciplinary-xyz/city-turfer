import './app-header.css';

import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { SECTION_ANCHORS } from '../home-sections/home-sections.constants';
import { LanguageSwitcher } from '../language-switcher';
import type { AppHeaderProps } from './app-header.constants';
import { AppHeaderView } from './app-header-view';
import { HeaderNavSync } from './header-nav-sync';

/** Sticky top bar, solid from the start: the logo, (on the landing page) the section links, the waitlist link and the language switcher. */
export function AppHeader({ locale, waitlist, waitlistHref = '#waitlist', nav = false }: AppHeaderProps) {
  const t = useTranslations('header');
  const anchors = [
    ['how', SECTION_ANCHORS.how],
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
            <Image className='app-header-mark' src={mark} alt='' width={32} height={32} />
            <Image className='app-header-wordmark' src={wordmark} alt='' width={90} height={20} />
          </>
        }
        waitlist={waitlist ? { href: waitlistHref, label: t('waitlist'), shortLabel: t('waitlistShort') } : null}
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
