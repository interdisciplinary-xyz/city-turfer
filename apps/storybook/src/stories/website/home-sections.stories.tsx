import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import {
  Audience,
  Differs,
  Faq,
  FinalCta,
  Highlights,
  HowItWorks,
  LocalFirst,
  WhereItStands,
  YourWeek,
} from '@/app/[locale]/home-sections';
import { TurfDemo } from '@/app/[locale]/turf-demo';

/** Everything under the hero and the waitlist, in page order. */
function HomeSections() {
  return (
    <>
      <TurfDemo />
      <HowItWorks />
      <Audience />
      <Highlights />
      <YourWeek />
      <Differs />
      <LocalFirst />
      <WhereItStands />
      <Faq />
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
          "The landing page below the hero, drawn in the app's own pieces as CSS (Card, Stat, ActivityRow, type chips, the Record button, TurfLegend): the street-glow demo, how it works, who it's for, highlights, the Dashboard with an example week, how it differs, local-first, where it stands, the FAQ and a call back to the waitlist (docs/plans/homepage-sections-2026-10-28.md). Copy comes from apps/web/messages (home.*).",
      },
    },
  },
} satisfies Meta<typeof HomeSections>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const HowItWorksOnly: StoryObj<typeof meta> = { render: () => <HowItWorks /> };

export const YourWeekOnly: StoryObj<typeof meta> = { render: () => <YourWeek /> };

export const TurfDemoOnly: StoryObj<typeof meta> = { render: () => <TurfDemo /> };

export const AudienceOnly: StoryObj<typeof meta> = { render: () => <Audience /> };

export const HighlightsOnly: StoryObj<typeof meta> = { render: () => <Highlights /> };

export const DiffersOnly: StoryObj<typeof meta> = { render: () => <Differs /> };

export const WhereItStandsOnly: StoryObj<typeof meta> = { render: () => <WhereItStands /> };

export const FaqOnly: StoryObj<typeof meta> = { render: () => <Faq /> };
