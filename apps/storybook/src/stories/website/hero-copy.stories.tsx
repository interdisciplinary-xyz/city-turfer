import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { HeroCopy } from '@/app/[locale]/hero-copy';

/** HeroCopy inside the hero's grid, so it gets the site's spacing and type. */
function HeroCopyInHero() {
  return (
    <div className='hero'>
      <div className='wrap hero-grid'>
        <HeroCopy waitlist />
      </div>
    </div>
  );
}

const meta = {
  title: 'Website/HeroCopy',
  component: HeroCopyInHero,
  parameters: {
    docs: {
      description: {
        component:
          'The Early prototype badge, the tagline, the pitch and the two buttons at the top of the landing page (the brand sits in the header). Copy comes from apps/web/messages (switch the language in the toolbar).',
      },
    },
  },
} satisfies Meta<typeof HeroCopyInHero>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
