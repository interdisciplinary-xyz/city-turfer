import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import {
  Audience,
  Faq,
  FinalCta,
  Highlights,
  HowItWorks,
  LocalFirst,
  Section,
  SectionHead,
  WhereItStands,
} from '@/app/[locale]/home-sections';
import { TurfDemo } from '@/app/[locale]/turf-demo';

/** Everything under the hero and the waitlist, in page order (the glow demo is inside How it works). */
function HomeSections() {
  return (
    <>
      <HowItWorks />
      <Audience />
      <Highlights />
      <LocalFirst />
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
          "The landing page below the hero, drawn in the app's own pieces as CSS (Card, Stat, ActivityRow, type chips, the Record button, TurfLegend): how it works (three cards, then the street-glow demo), who it's for with what is different, the app's highlights with where it stands, privacy, the FAQ and a call back to the waitlist (docs/plans/homepage-sections-2026-10-28.md). Copy comes from apps/web/messages (home.*).",
      },
    },
  },
} satisfies Meta<typeof HomeSections>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const HowItWorksOnly: StoryObj<typeof meta> = { render: () => <HowItWorks /> };

/** The glow demo on its own (it lives inside "How it works" on the page). */
export const TurfDemoOnly: StoryObj<typeof meta> = {
  render: () => (
    <Section name='how'>
      <TurfDemo />
    </Section>
  ),
};

export const AudienceOnly: StoryObj<typeof meta> = { render: () => <Audience /> };

export const HighlightsOnly: StoryObj<typeof meta> = { render: () => <Highlights /> };

export const WhereItStandsOnly: StoryObj<typeof meta> = { render: () => <WhereItStands /> };

export const FaqOnly: StoryObj<typeof meta> = { render: () => <Faq /> };

/** The shared heading: eyebrow (plain name), claim and an optional lede; centred for the closing sections. */
export const SectionHeading: StoryObj<typeof meta> = {
  render: () => (
    <Section name='how'>
      <SectionHead
        name='how'
        eyebrow='How it works'
        title='One loop. Every street.'
        lede='Record an outing, see the turf you gained, watch it glow when you come back.'
      />
    </Section>
  ),
};

export const SectionHeadingCentred: StoryObj<typeof meta> = {
  render: () => (
    <Section name='cta'>
      <SectionHead name='cta' eyebrow='Waitlist' title='Your turf starts at your door' align='center' />
    </Section>
  ),
};
