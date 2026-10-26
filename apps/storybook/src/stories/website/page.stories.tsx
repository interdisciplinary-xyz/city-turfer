import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale, useTranslations } from 'next-intl';

import { AppHeader } from '@/app/[locale]/app-header';
import { HeroCopy } from '@/app/[locale]/hero-copy';
import { HeroMotion } from '@/app/[locale]/hero-motion';
import { HeroScreens } from '@/app/[locale]/hero-screens';
import { FinalCta, HowItWorks, LocalFirst, YourWeek } from '@/app/[locale]/home-sections';
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
      <AppHeader locale={locale} waitlist={waitlist} />
      <main id='main'>
        <div className='hero'>
          <HeroMotion className='wrap hero-grid'>
            <HeroCopy />
            <HeroScreens />
          </HeroMotion>
        </div>
        {waitlist ? (
          <section id='waitlist' className='waitlist-section' aria-label={t('waitlist.title')}>
            <div className='wrap'>
              <WaitlistForm
                action='https://example.invalid/brevo'
                controller='CityTurfer (example)'
                contactEmail='privacy@example.invalid'
                locale={locale}
              />
            </div>
          </section>
        ) : null}
        <HowItWorks />
        <YourWeek />
        <LocalFirst />
        {waitlist ? <FinalCta /> : null}
      </main>
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
          'The full landing page: hero (with its entrance animation), the waitlist section, how it works, your week, local-first and the closing call to action (shown only with the waitlist). `waitlist` mirrors the NEXT_PUBLIC_WAITLIST_* variables being set. The APK download buttons are hidden for now.',
      },
    },
  },
} satisfies Meta<typeof Page>;

export default meta;

export const Launch: StoryObj<typeof meta> = {};

export const BeforeLaunch: StoryObj<typeof meta> = {
  args: { waitlist: false },
};
