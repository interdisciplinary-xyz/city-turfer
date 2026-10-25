import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '../../../language-switcher';
import type { PortalHeaderProps } from './portal-header.constants';

/** The portal's top bar: logo (to the website), the section links, the language links for this page, and actions. */
export function PortalHeader({ locale, path, actions, nav }: PortalHeaderProps) {
  const t = useTranslations('portal.header');
  return (
    <header className='portal-header'>
      <div className='portal-header-inner'>
        <a className='portal-header-home' href={`/${locale}`} aria-label={t('home')}>
          <Image className='portal-header-mark' src={mark} alt='' width={28} height={28} />
          <Image className='portal-header-wordmark' src={wordmark} alt='' width={115} height={20} />
        </a>
        {nav}
        <div className='portal-header-actions'>
          <LanguageSwitcher locale={locale} href={path} />
          {actions}
        </div>
      </div>
    </header>
  );
}
