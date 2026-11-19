import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';

import {
  Audience,
  Faq,
  Highlights,
  HowItWorks,
  Join,
  LocalFirst,
  Section,
  SectionHead,
  TurfDemo,
  WhereItStands,
} from '@/domains/homepage';
import { WaitlistForm } from '@/domains/waitlist';
import type { Locale } from '@/i18n/routing';

/** The waitlist form as the page passes it into Join (it posts to an address that never answers). */
function ExampleForm() {
  const locale = useLocale() as Locale;
  return (
    <WaitlistForm
      action='https://example.invalid/brevo'
      controller='CityTurfer (example)'
      contactEmail='privacy@example.invalid'
      locale={locale}
      headingId='join-title'
    />
  );
}

/** Everything under the hero, in page order (the glow demo is inside How it works). */
function HomeSections() {
  return (
    <>
      <HowItWorks />
      <Highlights />
      <Audience />
      <LocalFirst />
      <Faq />
      <Join form={<ExampleForm />} />
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
          "The landing page below the hero, drawn in the app's own pieces as CSS (Card, Stat, ActivityRow, type chips, the Record button, TurfLegend): how it works (three cards, then the street-glow demo), what you get (six tiles with tags), who it's for, privacy, the FAQ and Join (where it stands, then the waitlist form or a closed line) (docs/plans/homepage-value-2026-11-19.md). Copy comes from apps/web/messages (home.*).",
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

/** The last section with the waitlist form (the NEXT_PUBLIC_WAITLIST_* variables are set). */
export const JoinWithForm: StoryObj<typeof meta> = { render: () => <Join form={<ExampleForm />} /> };

/** Without the form: the stage strip and one honest line (the variables are not set). */
export const JoinWithoutForm: StoryObj<typeof meta> = { render: () => <Join /> };

/** Six tiles, three and three; the tags read "New" (Share photo) and "iPhone only" (Apple Watch). */
export const HighlightsWithTags: StoryObj<typeof meta> = { render: () => <Highlights /> };

export const WhereItStandsOnly: StoryObj<typeof meta> = { render: () => <WhereItStands /> };

export const FaqOnly: StoryObj<typeof meta> = { render: () => <Faq /> };

/** The shared heading: eyebrow (plain name), claim and an optional lede, centred in every section. */
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
