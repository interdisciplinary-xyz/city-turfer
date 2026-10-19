import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';

import { HeroCopy } from '@/app/[locale]/hero-copy';
import { HeroMotion } from '@/app/[locale]/hero-motion';
import { HeroScreens } from '@/app/[locale]/hero-screens';
import { LanguageSwitcher } from '@/app/[locale]/language-switcher';
import { StoreButtons } from '@/app/[locale]/store-buttons';
import type { Locale } from '@/i18n/routing';

/** The landing page's hero as apps/web/src/app/[locale]/page.tsx composes it. */
function Hero({ apkUrl }: { apkUrl: string | null }) {
  const locale = useLocale() as Locale;
  return (
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
  );
}

const meta = {
  title: 'Website/Hero',
  component: Hero,
  args: { apkUrl: null },
  parameters: {
    docs: {
      description: {
        component:
          'The whole first screen of cityturfer.com, always dark. Switch the language in the toolbar. The entrance animation runs on load (GSAP, `web-motion` skill).',
      },
    },
  },
} satisfies Meta<typeof Hero>;

export default meta;

export const ComingSoon: StoryObj<typeof meta> = {};

export const AndroidAvailable: StoryObj<typeof meta> = {
  args: { apkUrl: 'https://example.invalid/cityturfer.apk' },
};
