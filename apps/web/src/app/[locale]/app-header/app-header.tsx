import './app-header.css';

import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '../language-switcher';
import type { AppHeaderProps } from './app-header.constants';
import { AppHeaderView } from './app-header-view';

/**
 * Sticky top bar, solid from the start: the logo, the waitlist link, "Sign in", "Create account"
 * and the language switcher.
 */
export function AppHeader({ locale, waitlist, waitlistHref = '#waitlist', account = true }: AppHeaderProps) {
  const t = useTranslations('header');
  return (
    <AppHeaderView
      homeHref={`/${locale}`}
      homeLabel={t('home')}
      logo={
        <>
          <Image className='app-header-mark' src={mark} alt='' width={32} height={32} />
          <Image className='app-header-wordmark' src={wordmark} alt='' width={93} height={20} />
        </>
      }
      waitlist={waitlist ? { href: waitlistHref, label: t('waitlist'), shortLabel: t('waitlistShort') } : null}
      account={
        account
          ? {
              signIn: { href: `/${locale}/account/sign-in`, label: t('signIn') },
              register: { href: `/${locale}/account/register`, label: t('register') },
            }
          : null
      }
      languages={<LanguageSwitcher locale={locale} />}
    />
  );
}
