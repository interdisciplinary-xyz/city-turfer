import { ShareOverlay } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';

import { EN, PL, PREVIEW_WIDTH, SAMPLE_PHOTO, WORDMARK } from './share-overlay.constants';

const meta = {
  title: 'App/ShareOverlay',
  component: ShareOverlay,
  parameters: {
    docs: {
      description: {
        component:
          'The share card (Share photo): stats, name, date, optional place and the wordmark over night scrims on the ' +
          "Turfer's photo, 9:16, laid out on a 1080 × 1920 canvas scaled by width / 1080. No map, no coordinates. " +
          'The app passes its SF Symbol as the type icon; here a glyph stands in.',
      },
    },
  },
  args: {
    ...EN,
    width: PREVIEW_WIDTH,
    layout: 'top',
    photo: SAMPLE_PHOTO.white,
    wordmark: WORDMARK,
    renderTypeIcon: (size: number, color: string) => <Text style={{ fontSize: size * 0.8, color }}>🏃</Text>,
    accessibilityLabel: 'Share card',
  },
} satisfies Meta<typeof ShareOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Worst case for legibility: a white photo (DARK.text on the 0.6 scrim is 4.51 : 1). */
export const WhitePhoto: Story = {};

export const DarkPhoto: Story = { args: { photo: SAMPLE_PHOTO.dark } };

export const BusyPhoto: Story = { args: { photo: SAMPLE_PHOTO.busy } };

export const LayoutBottom: Story = { args: { layout: 'bottom' } };

export const LayoutBottomBusy: Story = { args: { layout: 'bottom', photo: SAMPLE_PHOTO.busy } };

/** No turf line (none gained, or toggled off) and no place (Off, the default). */
export const Minimal: Story = { args: { turfLine: undefined, place: undefined } };

/** Polish, a ride: longest values (`1:34:44`, `102,35 km`) and a two-line title. */
export const PolishLongValues: Story = {
  args: {
    ...PL,
    renderTypeIcon: (size: number, color: string) => <Text style={{ fontSize: size * 0.8, color }}>🚴</Text>,
  },
};

export const PolishLayoutBottom: Story = {
  args: {
    ...PL,
    layout: 'bottom',
    renderTypeIcon: (size: number, color: string) => <Text style={{ fontSize: size * 0.8, color }}>🚴</Text>,
  },
};

/** Every photo in both layouts, side by side. */
export const Matrix: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {(['white', 'dark', 'busy'] as const).flatMap((photo) =>
        (['top', 'bottom'] as const).map((layout) => (
          <ShareOverlay key={`${photo}-${layout}`} {...args} width={240} layout={layout} photo={SAMPLE_PHOTO[photo]} />
        ))
      )}
    </View>
  ),
};
