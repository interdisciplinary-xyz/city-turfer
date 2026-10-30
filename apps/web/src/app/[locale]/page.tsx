import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { WAITLIST } from '../waitlist-config';
import { AppHeader } from './app-header';
import { HeroCopy } from './hero-copy';
import { HeroMotion } from './hero-motion';
import { HeroScreens } from './hero-screens';
import {
  Audience,
  Differs,
  Faq,
  FinalCta,
  Highlights,
  HowItWorks,
  LocalFirst,
  WhereItStands,
  YourWeek,
} from './home-sections';
import { SiteFooter } from './site-footer';
import { TurfDemo } from './turf-demo';
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
      <AppHeader locale={locale} waitlist={Boolean(WAITLIST)} />
      <main id='main'>
        <div className='hero'>
          <HeroMotion className='wrap hero-grid'>
            <HeroCopy />
            <HeroScreens />
            {/* No download buttons for now: the waitlist comes first (StoreButtons stays for later). */}
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
        <TurfDemo />
        <HowItWorks />
        <Audience />
        <Highlights />
        <YourWeek />
        <Differs />
        <LocalFirst />
        <WhereItStands />
        <Faq />
        {WAITLIST ? <FinalCta /> : null}
      </main>
      <SiteFooter contactEmail={WAITLIST?.contactEmail} />
    </>
  );
}
