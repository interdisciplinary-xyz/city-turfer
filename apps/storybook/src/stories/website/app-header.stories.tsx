import type { Decorator, Meta, StoryObj } from '@storybook/react-native-web-vite';

import { AppHeader } from '@/domains/layout';

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
  args: { locale: 'en', nav: true, waitlistSection: true },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'pl'] } },
  decorators: [withScroll],
  parameters: {
    docs: {
      description: {
        component:
          'Sticky top bar across the full window width (48 px side padding from 600 px): the logo on the left; on the right the section links (the landing page only, from 1024 px) and the language switcher. Solid from the start, on every page. The portal (sign in, create account) is reached by its own URLs, not from here.',
      },
    },
  },
} satisfies Meta<typeof AppHeader>;

export default meta;

/** The landing page's header: section links from 1024 px (the current one is marked by HeaderNavSync on the site). */
export const English: StoryObj<typeof meta> = {};

/** Other pages (and the dev pages): no section links. */
export const WithoutNav: StoryObj<typeof meta> = { args: { nav: false } };

export const Polish: StoryObj<typeof meta> = { args: { locale: 'pl' } };

/** The smallest phone we support: the logo mark and the switch must fit. */
export const Polish320: StoryObj<typeof meta> = {
  args: { locale: 'pl' },
  decorators: [(Story) => <div style={{ width: 320, border: '1px dashed var(--border)' }}>{Story()}</div>],
};
