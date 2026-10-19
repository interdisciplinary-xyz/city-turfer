import { TurfLegend } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const meta = {
  title: 'App/TurfLegend',
  component: TurfLegend,
  parameters: {
    docs: {
      description: {
        component: 'Turf strength tiers, weakest to strongest. New in v0.5.0: not on any app screen yet.',
      },
    },
  },
} satisfies Meta<typeof TurfLegend>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Compact: StoryObj<typeof meta> = { args: { compact: true, style: { width: 160 } } };

/** Labels are props, so a translation drops in (Polish shown). */
export const Translated: StoryObj<typeof meta> = {
  args: {
    title: 'Siła turfu',
    labels: { faint: 'Słaby', glowing: 'Żarzący', strong: 'Mocny', blazing: 'Płonący' },
  },
};
