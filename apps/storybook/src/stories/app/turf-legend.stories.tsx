import { TurfLegend } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { NightPanel } from '../../decorators/frame';

const meta = {
  title: 'App/TurfLegend',
  component: TurfLegend,
  parameters: {
    docs: {
      description: {
        component:
          'Turf strength tiers, weakest to strongest. New in v0.5.0: not on any app screen yet. On a light page it sits on a card; over a map it sits on night (maps stay dark), where the tiers glow.',
      },
    },
  },
} satisfies Meta<typeof TurfLegend>;

export default meta;

export const Default: StoryObj<typeof meta> = { args: { style: { maxWidth: 360 } } };

export const Compact: StoryObj<typeof meta> = { args: { compact: true, style: { width: 160 } } };

/** Labels are props, so a translation drops in (Polish shown). */
export const Translated: StoryObj<typeof meta> = {
  args: {
    style: { maxWidth: 360 },
    title: 'Siła turfu',
    labels: { faint: 'Słaby', glowing: 'Rozżarzony', strong: 'Mocny', blazing: 'Płonący' },
  },
};

/** Over a map: maps stay dark, so the legend takes the dark palette on a night panel. */
export const OnMap: StoryObj<typeof meta> = {
  args: { style: { maxWidth: 360 } },
  render: (args) => (
    <NightPanel>
      <TurfLegend {...args} />
    </NightPanel>
  ),
};
