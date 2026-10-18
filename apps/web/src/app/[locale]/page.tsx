import { NAME } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { ANDROID_APK_URL } from '../download-url';
import { LanguageSwitcher } from './language-switcher';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <>
      <a className='skip' href='#main'>
        {t('hero.skip')}
      </a>
      <main id='main' className='hero'>
        <div className='wrap hero-bar'>
          <LanguageSwitcher locale={locale} />
        </div>
        <div className='wrap hero-grid'>
          <div className='hero-copy'>
            <Image className='mark' src={mark} alt='' priority width={132} height={132} />
            <Image className='wordmark' src={wordmark} alt={NAME} priority width={320} height={101} />
            <h1>
              {t('hero.taglineLead')} <span className='ramp-text'>{t('hero.taglineRamp')}</span>
            </h1>
            <p className='lede'>{t('hero.lede')}</p>
            {ANDROID_APK_URL ? (
              <div className='download'>
                <a className='download-btn' href={ANDROID_APK_URL} download>
                  {t('download.cta')}
                </a>
                <p className='download-note'>
                  {t('download.note')}. {t('download.help')}
                </p>
                <p className='pill'>
                  <span className='pill-dot' aria-hidden='true' />
                  {t('download.iphone')}
                </p>
              </div>
            ) : (
              <p className='pill'>
                <span className='pill-dot' aria-hidden='true' />
                {t('hero.comingSoon')}
              </p>
            )}
          </div>
          <div className='screens'>
            <figure className='screen'>
              <div className='phone'>
                <Image src='/screens/turf-map.jpg' alt={t('screens.turfMap.alt')} width={720} height={1565} priority />
              </div>
              <figcaption>
                <strong>{t('screens.turfMap.title')}</strong>
                {t('screens.turfMap.body')}
              </figcaption>
            </figure>
            <figure className='screen'>
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
        </div>
      </main>
    </>
  );
}
