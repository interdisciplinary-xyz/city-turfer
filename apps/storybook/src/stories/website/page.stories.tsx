import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale, useTranslations } from 'next-intl';

import { AppHeader } from '@/app/[locale]/app-header';
import { HeroCity, HeroCityLine } from '@/app/[locale]/hero-city';
import { HeroCopy } from '@/app/[locale]/hero-copy';
import { HeroMotion } from '@/app/[locale]/hero-motion';
import { HeroScreens } from '@/app/[locale]/hero-screens';
import {
  Audience,
  Faq,
  FinalCta,
  Highlights,
  HowItWorks,
  LocalFirst,
  Section,
  SectionHead,
} from '@/app/[locale]/home-sections';
import { SiteFooter } from '@/app/[locale]/site-footer';
import { WaitlistForm } from '@/app/[locale]/waitlist-form';
import type { Locale } from '@/i18n/routing';

type PageProps = { waitlist: boolean };

/**
 * The whole landing page as apps/web/src/app/[locale]/page.tsx composes it (a server component,
 * so it can't render here directly). The waitlist posts to an address that never answers.
 */
function Page({ waitlist }: PageProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations();
  return (
    <>
      <a className='skip' href='#main'>
        {t('hero.skip')}
      </a>
      <AppHeader locale={locale} waitlist={waitlist} nav />
      <main id='main' tabIndex={-1}>
        <section id='top' aria-labelledby='hero-title'>
          <HeroMotion className='hero'>
            <HeroCity />
            <div className='wrap hero-grid'>
              <HeroCopy waitlist={waitlist} />
              <HeroScreens />
            </div>
            <HeroCityLine />
          </HeroMotion>
        </section>
        {waitlist ? (
          <Section name='waitlist' className='waitlist-section'>
            <SectionHead name='waitlist' eyebrow={t('waitlist.eyebrow')} title={t('waitlist.title')} align='center' />
            <WaitlistForm
              action='https://example.invalid/brevo'
              controller='CityTurfer (example)'
              contactEmail='privacy@example.invalid'
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
        {waitlist ? <FinalCta /> : null}
      </main>
      <SiteFooter contactEmail={waitlist ? 'privacy@example.invalid' : undefined} />
    </>
  );
}

const meta = {
  title: 'Website/Page',
  component: Page,
  args: { waitlist: true },
  parameters: {
    docs: {
      description: {
        component:
          'The full landing page: hero (with its entrance animation and the prototype badge), the waitlist section, the street-glow demo, how it works, who it is for, highlights, your week, how it differs, local-first, where it stands, the FAQ, the closing call to action (shown only with the waitlist) and the footer. `waitlist` mirrors the NEXT_PUBLIC_WAITLIST_* variables being set. The APK download buttons are hidden for now.',
      },
    },
  },
} satisfies Meta<typeof Page>;

export default meta;

export const Launch: StoryObj<typeof meta> = {};

export const BeforeLaunch: StoryObj<typeof meta> = {
  args: { waitlist: false },
};
