import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { WAITLIST } from '../waitlist-config';
import { AppHeader } from './app-header';
import { HeroCity, HeroCityLine } from './hero-city';
import { HeroCopy } from './hero-copy';
import { HeroMotion } from './hero-motion';
import { HeroScreens } from './hero-screens';
import { Audience, Faq, FinalCta, Highlights, HowItWorks, LocalFirst, Section, SectionHead } from './home-sections';
import { SiteFooter } from './site-footer';
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
      <AppHeader locale={locale} waitlist={Boolean(WAITLIST)} nav />
      {/* tabIndex -1: the skip link moves focus to <main> (the header's links scroll to their sections). */}
      <main id='main' tabIndex={-1}>
        <section id='top' aria-labelledby='hero-title'>
          <HeroMotion className='hero'>
            <HeroCity />
            <div className='wrap hero-grid'>
              <HeroCopy waitlist={Boolean(WAITLIST)} />
              <HeroScreens />
              {/* No download buttons for now: the waitlist comes first (StoreButtons stays for later). */}
            </div>
            <HeroCityLine />
          </HeroMotion>
        </section>
        {WAITLIST ? (
          <Section name='waitlist' band className='waitlist-section'>
            <SectionHead name='waitlist' eyebrow={t('waitlist.eyebrow')} title={t('waitlist.title')} align='center' />
            <WaitlistForm
              action={WAITLIST.url}
              controller={WAITLIST.controller}
              contactEmail={WAITLIST.contactEmail}
              locale={locale}
              headingId='waitlist-title'
            />
          </Section>
        ) : null}
        <HowItWorks />
        <Audience />
        <Highlights />
        <LocalFirst />
        <Faq />
        {WAITLIST ? <FinalCta /> : null}
      </main>
      <SiteFooter contactEmail={WAITLIST?.contactEmail} />
    </>
  );
}
