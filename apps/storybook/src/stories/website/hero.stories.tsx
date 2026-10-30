import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { HeroCity, HeroCityLine } from '@/app/[locale]/hero-city';
import { HeroCopy } from '@/app/[locale]/hero-copy';
import { HeroMotion } from '@/app/[locale]/hero-motion';
import { HeroScreens } from '@/app/[locale]/hero-screens';
import { StoreButtons } from '@/app/[locale]/store-buttons';

/** The landing page's hero as apps/web/src/app/[locale]/page.tsx composes it. */
function Hero({ apkUrl }: { apkUrl: string | null }) {
  return (
    <HeroMotion className='hero'>
      <HeroCity />
      <div className='wrap hero-grid'>
        <HeroCopy />
        <HeroScreens />
        <StoreButtons apkUrl={apkUrl} />
      </div>
      <HeroCityLine />
    </HeroMotion>
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
          "The whole first screen of cityturfer.com, in the site's dark scheme (`SITE_SCHEME`, like the app). Switch the language in the toolbar (the language switcher lives in the sticky AppHeader). The entrance animation runs on load (GSAP, `web-motion` skill). The street map behind it follows your time zone; pick another city in the line under the hero.",
      },
    },
  },
} satisfies Meta<typeof Hero>;

export default meta;

export const ComingSoon: StoryObj<typeof meta> = {};

export const AndroidAvailable: StoryObj<typeof meta> = {
  args: { apkUrl: 'https://example.invalid/cityturfer.apk' },
};
