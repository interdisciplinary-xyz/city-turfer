import type { Decorator, Meta, StoryObj } from '@storybook/react-native-web-vite';

import { AppHeader } from '@/app/[locale]/app-header';

/** Lets the sticky header be scrolled against; `scrolled` sets the attribute the page script sets. */
const withScroll: Decorator = (Story) => (
  <>
    <Story />
    <div style={{ height: '150vh', padding: 24, color: 'var(--muted)' }}>Scroll: the header stays pinned.</div>
  </>
);

/** Sets the attribute the page's ScrollState sets, so the scrolled look can be reviewed on its own. */
const forceScrolled: Decorator = (Story) => (
  <div ref={(el) => el?.querySelector('header')?.setAttribute('data-scrolled', '')}>
    <Story />
  </div>
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
          'Sticky top bar with the waitlist link, Sign in and Create account (the web portal; Create account hides below 600 px). The logo and background appear once the hero lockup leaves the viewport (an IntersectionObserver in `ScrollState`, which needs the hero on the page; see Website/Page). The Scrolled story forces that state.',
      },
    },
  },
} satisfies Meta<typeof AppHeader>;

export default meta;

export const English: StoryObj<typeof meta> = {};

export const Polish: StoryObj<typeof meta> = { args: { locale: 'pl' } };

export const NoWaitlist: StoryObj<typeof meta> = { args: { waitlist: false } };

export const NoAccountLinks: StoryObj<typeof meta> = { args: { account: false } };

export const Scrolled: StoryObj<typeof meta> = { decorators: [forceScrolled] };
