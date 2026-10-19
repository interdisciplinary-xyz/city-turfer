import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale, useTranslations } from 'next-intl';

import { HeroCopy } from '@/app/[locale]/hero-copy';
import { HeroMotion } from '@/app/[locale]/hero-motion';
import { HeroScreens } from '@/app/[locale]/hero-screens';
import { LanguageSwitcher } from '@/app/[locale]/language-switcher';
import { StoreButtons } from '@/app/[locale]/store-buttons';
import { WaitlistForm } from '@/app/[locale]/waitlist-form';
import type { Locale } from '@/i18n/routing';

type PageProps = { apkUrl: string | null; waitlist: boolean };

/**
 * The whole landing page as apps/web/src/app/[locale]/page.tsx composes it (a server component,
 * so it can't render here directly). The waitlist posts to an address that never answers.
 */
function Page({ apkUrl, waitlist }: PageProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations();
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
            <StoreButtons apkUrl={apkUrl} />
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
      </main>
    </>
  );
}

const meta = {
  title: 'Website/Page',
  component: Page,
  args: { apkUrl: 'https://example.invalid/cityturfer.apk', waitlist: true },
  parameters: {
    docs: {
      description: {
        component:
          'The full landing page: hero (with its entrance animation), store buttons and the waitlist section. `waitlist` mirrors the NEXT_PUBLIC_WAITLIST_* variables being set; `apkUrl` mirrors NEXT_PUBLIC_ANDROID_APK_URL.',
      },
    },
  },
} satisfies Meta<typeof Page>;

export default meta;

export const Launch: StoryObj<typeof meta> = {};

export const BeforeLaunch: StoryObj<typeof meta> = {
  args: { apkUrl: null, waitlist: false },
};
