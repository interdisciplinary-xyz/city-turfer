import { TIER_COLOR, TYPE_COLOR } from '@cityturfer/brand';
import { Badge, tint } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';

const meta = {
  title: 'App/Badge',
  component: Badge,
  args: { glyph: '🏃', tint: tint(TYPE_COLOR.run) },
} satisfies Meta<typeof Badge>;

export default meta;

export const Activity: StoryObj<typeof meta> = {};

export const AllActivityTypes: StoryObj<typeof meta> = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Badge glyph='🚶' tint={tint(TYPE_COLOR.walk)} />
      <Badge glyph='🏃' tint={tint(TYPE_COLOR.run)} />
      <Badge glyph='🚴' tint={tint(TYPE_COLOR.cycle)} />
    </View>
  ),
};

/** Achievements: 52 pt, the app passes its SF Symbol as children (a star stands in here). */
export const Achievement: StoryObj<typeof meta> = {
  args: {
    glyph: undefined,
    size: 52,
    tint: tint(TIER_COLOR.strong),
    children: <Text style={{ fontSize: 22, color: TIER_COLOR.strong }}>★</Text>,
  },
};
