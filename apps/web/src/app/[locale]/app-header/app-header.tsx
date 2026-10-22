import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '../language-switcher';
import type { AppHeaderProps } from './app-header.constants';
import { ScrollState } from './scroll-state';

/**
 * Sticky top bar. At rest only the language switcher (and the waitlist link) show; once the hero's
 * own logo has scrolled away the bar gets a background and its logo fades in (`ScrollState`).
 */
export function AppHeader({ locale, waitlist }: AppHeaderProps) {
  const t = useTranslations('header');
  return (
    <header className='app-header'>
      <div className='wrap app-header-inner'>
        <a className='app-header-home' href={`/${locale}`} aria-label={t('home')}>
          <Image className='app-header-mark' src={mark} alt='' width={32} height={32} />
          <Image className='app-header-wordmark' src={wordmark} alt='' width={115} height={20} />
        </a>
        <div className='app-header-actions'>
          {waitlist ? (
            <a className='app-header-link' href='#waitlist' aria-label={t('waitlist')}>
              <span className='app-header-link-long'>{t('waitlist')}</span>
              <span className='app-header-link-short' aria-hidden='true'>
                {t('waitlistShort')}
              </span>
            </a>
          ) : null}
          <LanguageSwitcher locale={locale} />
        </div>
        <ScrollState />
      </div>
    </header>
  );
}
