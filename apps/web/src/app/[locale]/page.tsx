import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { ANDROID_APK_URL } from '../download-url';
import { WAITLIST } from '../waitlist-config';
import { HeroCopy } from './hero-copy';
import { HeroMotion } from './hero-motion';
import { HeroScreens } from './hero-screens';
import { LanguageSwitcher } from './language-switcher';
import { StoreButtons } from './store-buttons';
import { WaitlistForm } from './waitlist-form';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <>
      <a className='skip' href='#main'>
        {t('hero.skip')}
      </a>
      <main id='main'>
        <div className='hero'>
          <div className='wrap hero-bar'>
            <LanguageSwitcher locale={locale} />
          </div>
          <HeroMotion className='wrap hero-grid'>
            <HeroCopy />
            <HeroScreens />
            <StoreButtons apkUrl={ANDROID_APK_URL} />
          </HeroMotion>
        </div>
        {WAITLIST ? (
          <section id='waitlist' className='waitlist-section' aria-label={t('waitlist.title')}>
            <div className='wrap'>
              <WaitlistForm
                action={WAITLIST.url}
                controller={WAITLIST.controller}
                contactEmail={WAITLIST.contactEmail}
                locale={locale}
              />
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
