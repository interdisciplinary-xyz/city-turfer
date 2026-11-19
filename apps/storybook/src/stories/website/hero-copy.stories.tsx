import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { HeroCopy } from '@/domains/homepage';

/** HeroCopy inside the hero's grid, so it gets the site's spacing and type. */
function HeroCopyInHero({ waitlist }: { waitlist: boolean }) {
  return (
    <div className='hero'>
      <div className='wrap hero-grid'>
        <HeroCopy waitlist={waitlist} />
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
          'The tagline, the pitch and the two buttons at the top of the landing page (the brand sits in the header). Copy comes from apps/web/messages (switch the language in the toolbar).',
      },
    },
  },
  args: { waitlist: true },
} satisfies Meta<typeof HeroCopyInHero>;

export default meta;

/** The Brevo variables are set: the primary button reads "Join the waitlist" and lands on #join. */
export const Default: StoryObj<typeof meta> = {};

/** Not set: "How to get it" still lands on #join, which then shows the stage and a closed line. */
export const WithoutWaitlist: StoryObj<typeof meta> = { args: { waitlist: false } };
