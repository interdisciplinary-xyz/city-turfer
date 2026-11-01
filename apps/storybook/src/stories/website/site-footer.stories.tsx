import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { SiteFooter } from '@/app/[locale]/site-footer';

const meta = {
  title: 'Website/SiteFooter',
  component: SiteFooter,
  args: { contactEmail: 'privacy@example.invalid' },
  parameters: {
    docs: {
      description: {
        component:
          'Wordmark and tagline, the four section links, contact and what the site does not do (no cookies, no trackers), then ©. No portal link. Switch the language in the toolbar.',
      },
    },
  },
} satisfies Meta<typeof SiteFooter>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

/** Before the waitlist is set up there is no contact address. */
export const NoContact: StoryObj<typeof meta> = { args: { contactEmail: undefined } };
