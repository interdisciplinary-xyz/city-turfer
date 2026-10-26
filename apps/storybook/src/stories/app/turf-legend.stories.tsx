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
          'Turf strength tiers, weakest to strongest. New in v0.5.0: not on any app screen yet. On a page it sits on a card; over a map it sits on night, where the tiers glow. Both are dark, like the app.',
      },
    },
  },
} satisfies Meta<typeof TurfLegend>;

export default meta;

export const Default: StoryObj<typeof meta> = { args: { style: { maxWidth: 360 } } };

export const Compact: StoryObj<typeof meta> = { args: { compact: true, style: { width: 160 } } };

/** Text is props, so a translation drops in (Polish shown, as in the app's `common` namespace), screen-reader sentence included. */
export const Translated: StoryObj<typeof meta> = {
  args: {
    style: { maxWidth: 360 },
    title: 'Siła terytorium',
    labels: { faint: 'Blade', glowing: 'Świecące', strong: 'Mocne', blazing: 'Płonące' },
    accessibilityLabel: 'Siła terytorium: Blade, Świecące, Mocne, Płonące, od najsłabszego do najmocniejszego',
  },
};

/** Over a map: the legend on a night panel, the map's ground, in the dark palette like the rest of the site. */
export const OnMap: StoryObj<typeof meta> = {
  args: { style: { maxWidth: 360 } },
  render: (args) => (
    <NightPanel>
      <TurfLegend {...args} />
    </NightPanel>
  ),
};
