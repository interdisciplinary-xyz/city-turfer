import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { FinalCta, HowItWorks, LocalFirst, YourWeek } from '@/app/[locale]/home-sections';

/** Everything under the hero and the waitlist, in page order. */
function HomeSections() {
  return (
    <>
      <HowItWorks />
      <YourWeek />
      <LocalFirst />
      <FinalCta />
    </>
  );
}

const meta = {
  title: 'Website/HomeSections',
  component: HomeSections,
  parameters: {
    docs: {
      description: {
        component:
          "The landing page below the hero, drawn in the app's own pieces as CSS (Card, Stat, ActivityRow, type chips, the Record button, TurfLegend): how it works, the Dashboard with an example week, local-first, and a call back to the waitlist. Copy comes from apps/web/messages (home.*).",
      },
    },
  },
} satisfies Meta<typeof HomeSections>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const HowItWorksOnly: StoryObj<typeof meta> = { render: () => <HowItWorks /> };

export const YourWeekOnly: StoryObj<typeof meta> = { render: () => <YourWeek /> };
