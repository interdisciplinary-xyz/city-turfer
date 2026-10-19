import { NAME } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { ANDROID_APK_URL } from '../download-url';
import { WAITLIST } from '../waitlist-config';
import { HeroMotion } from './hero-motion';
import { LanguageSwitcher } from './language-switcher';
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
            <div className='hero-copy'>
              <Image className='mark' data-anim='mark' src={mark} alt='' priority width={132} height={132} />
              <Image
                className='wordmark'
                data-anim='wordmark'
                src={wordmark}
                alt={NAME}
                priority
                width={320}
                height={101}
              />
              <h1>
                <span className='line' data-anim='line'>
                  {t('hero.taglineLead')}
                </span>{' '}
                <span className='ramp-text' data-anim='line'>
                  {t('hero.taglineRamp')}
                </span>
              </h1>
              <p className='lede' data-anim='copy'>
                {t('hero.lede')}
              </p>
            </div>
            <div className='screens' data-anim-group='screens'>
              <figure className='screen' data-anim='phone'>
                <div className='phone'>
                  <Image
                    src='/screens/turf-map.jpg'
                    alt={t('screens.turfMap.alt')}
                    width={720}
                    height={1565}
                    priority
                  />
                </div>
                <figcaption>
                  <strong>{t('screens.turfMap.title')}</strong>
                  {t('screens.turfMap.body')}
                </figcaption>
              </figure>
              <figure className='screen' data-anim='phone'>
                <div className='phone'>
                  <Image
                    src='/screens/dashboard.jpg'
                    alt={t('screens.dashboard.alt')}
                    width={720}
                    height={1565}
                    priority
                  />
                </div>
                <figcaption>
                  <strong>{t('screens.dashboard.title')}</strong>
                  {t('screens.dashboard.body')}
                </figcaption>
              </figure>
            </div>
            <div className='download' data-anim='copy'>
              <div className='store-buttons'>
                {ANDROID_APK_URL ? (
                  <a className='store-btn store-btn-android' href={ANDROID_APK_URL} download>
                    {t('download.cta')}
                  </a>
                ) : (
                  <span className='store-btn store-btn-off' role='link' aria-disabled='true'>
                    {t('download.cta')}
                    <span className='store-soon'>{t('download.soon')}</span>
                  </span>
                )}
                <span className='store-btn store-btn-off' role='link' aria-disabled='true'>
                  {t('download.appStore')}
                  <span className='store-soon'>{t('download.soon')}</span>
                </span>
              </div>
              {ANDROID_APK_URL ? (
                <p className='download-note'>
                  {t('download.note')}. {t('download.help')}
                </p>
              ) : null}
            </div>
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
