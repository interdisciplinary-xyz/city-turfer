import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { HeroCity, HeroCopy, HeroMotion, HeroScreens, StoreButtons } from '@/domains/homepage';

/** The landing page's hero as apps/web/src/app/[locale]/page.tsx composes it. */
function Hero({ apkUrl }: { apkUrl: string | null }) {
  return (
    <HeroMotion className='hero'>
      <HeroCity />
      <div className='wrap hero-grid'>
        <HeroCopy waitlist />
        <HeroScreens />
        <StoreButtons apkUrl={apkUrl} />
      </div>
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
          "The whole first screen of cityturfer.com, in the site's light scheme (`WEB_SCHEME`); the phones keep the app's dark scheme (`APP_SCHEME`). Switch the language in the toolbar (the language switcher lives in the sticky AppHeader). The entrance animation runs on load (GSAP, `web-motion` skill). The street map behind it follows your time zone; pick another city in the line under the hero.",
      },
    },
  },
} satisfies Meta<typeof Hero>;

export default meta;

export const ComingSoon: StoryObj<typeof meta> = {};

export const AndroidAvailable: StoryObj<typeof meta> = {
  args: { apkUrl: 'https://example.invalid/cityturfer.apk' },
};
