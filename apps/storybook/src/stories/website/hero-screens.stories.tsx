import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { HeroScreens } from '@/app/[locale]/hero-screens';

/** HeroScreens inside the hero's grid, so the phones get the site's sizing. */
function HeroScreensInHero() {
  return (
    <div className='hero'>
      <div className='wrap hero-grid'>
        <HeroScreens />
      </div>
    </div>
  );
}

const meta = {
  title: 'Website/HeroScreens',
  component: HeroScreensInHero,
  parameters: {
    docs: {
      description: {
        component:
          'The two phone screenshots (Turf Map and Dashboard) with their captions. Images come from apps/web/public/screens.',
      },
    },
  },
} satisfies Meta<typeof HeroScreensInHero>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
