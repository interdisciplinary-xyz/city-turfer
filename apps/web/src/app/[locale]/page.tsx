import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HeroCity, HeroCopy, HeroMotion, HeroScreens } from '@/domains/homepage';
import { AppHeader } from '@/domains/layout';
import { WAITLIST } from '@/domains/waitlist';
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
      {/* Only the header and the hero for now: no section links, there are no sections to link to. */}
      <AppHeader locale={locale} />
      {/* tabIndex -1: the skip link moves focus to <main>. */}
      <main id='main' tabIndex={-1}>
        <section id='top' aria-labelledby='hero-title'>
          <HeroMotion className='hero'>
            <HeroCity />
            <div className='wrap hero-grid'>
              <HeroCopy waitlist={Boolean(WAITLIST)} />
              <HeroScreens />
            </div>
          </HeroMotion>
        </section>
      </main>
    </>
  );
}
