import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale, useTranslations } from 'next-intl';

import {
  Audience,
  Faq,
  HeroCity,
  HeroCopy,
  HeroMotion,
  HeroScreens,
  Highlights,
  HowItWorks,
  Join,
  LocalFirst,
} from '@/domains/homepage';
import { AppHeader, SiteFooter } from '@/domains/layout';
import { WaitlistForm } from '@/domains/waitlist';
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
      <AppHeader locale={locale} nav />
      <main id='main' tabIndex={-1}>
        <section id='top' aria-labelledby='hero-title'>
          <HeroMotion className='hero'>
            <HeroCity />
            <div className='wrap hero-grid'>
              <HeroCopy waitlist={waitlist} />
              <HeroScreens />
            </div>
          </HeroMotion>
        </section>
        <HowItWorks />
        <Highlights />
        <Audience />
        <LocalFirst />
        <Faq />
        <Join
          form={
            waitlist ? (
              <WaitlistForm
                action='https://example.invalid/brevo'
                controller='CityTurfer (example)'
                contactEmail='privacy@example.invalid'
                locale={locale}
                headingId='join-title'
              />
            ) : undefined
          }
        />
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
          'The full landing page: hero (with its entrance animation), how it works with the street-glow demo, what you get, who it is for, privacy, the FAQ, Join (where it stands, then the form with the waitlist or a closed line without) and the footer. `waitlist` mirrors the NEXT_PUBLIC_WAITLIST_* variables being set. The APK download buttons are hidden for now.',
      },
    },
  },
} satisfies Meta<typeof Page>;

export default meta;

export const Launch: StoryObj<typeof meta> = {};

export const BeforeLaunch: StoryObj<typeof meta> = {
  args: { waitlist: false },
};
