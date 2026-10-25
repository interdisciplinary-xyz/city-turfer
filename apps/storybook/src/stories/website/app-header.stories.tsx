import type { Decorator, Meta, StoryObj } from '@storybook/react-native-web-vite';

import { AppHeader } from '@/app/[locale]/app-header';

/** Lets the sticky header be scrolled against. */
const withScroll: Decorator = (Story) => (
  <>
    <Story />
    <div style={{ height: '150vh', padding: 24, color: 'var(--muted)' }}>Scroll: the header stays pinned.</div>
  </>
);

const meta = {
  title: 'Website/AppHeader',
  component: AppHeader,
  args: { locale: 'en', waitlist: true },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'pl'] } },
  decorators: [withScroll],
  parameters: {
    docs: {
      description: {
        component:
          'Sticky top bar with the waitlist link, Sign in and Create account (the web portal; Create account hides below 600 px). Solid from the start, logo included, on every page.',
      },
    },
  },
} satisfies Meta<typeof AppHeader>;

export default meta;

export const English: StoryObj<typeof meta> = {};

export const Polish: StoryObj<typeof meta> = { args: { locale: 'pl' } };

export const NoWaitlist: StoryObj<typeof meta> = { args: { waitlist: false } };

export const NoAccountLinks: StoryObj<typeof meta> = { args: { account: false } };
