import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  Audience,
  Faq,
  FinalCta,
  HeroCity,
  HeroCopy,
  HeroMotion,
  HeroScreens,
  Highlights,
  HowItWorks,
  LocalFirst,
  RevealMotion,
  Section,
  SectionHead,
} from '@/domains/homepage';
import { AppHeader, SiteFooter } from '@/domains/layout';
import { WAITLIST, WaitlistForm } from '@/domains/waitlist';
import type { Locale } from '@/i18n/routing';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <>
      <a className='skip' href='#main'>
        {t('hero.skip')}
      </a>
      <AppHeader locale={locale} nav waitlistSection={Boolean(WAITLIST)} />
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
          </HeroMotion>
        </section>
        {WAITLIST ? (
          <Section name='waitlist' band className='waitlist-section'>
            <SectionHead name='waitlist' eyebrow={t('waitlist.eyebrow')} title={t('waitlist.title')} />
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
      <RevealMotion />
      <SiteFooter contactEmail={WAITLIST?.contactEmail} />
    </>
  );
}
