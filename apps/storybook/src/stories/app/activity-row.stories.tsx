import { ActivityRow } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { fn } from 'storybook/test';

const meta = {
  title: 'App/ActivityRow',
  component: ActivityRow,
  args: {
    type: 'run',
    glyph: '🏃',
    title: 'Evening run',
    subtitle: 'Sun 18 Oct, 18:42',
    value: '5.02 km',
    detail: '28:14 · 5:37/km',
    accessibilityLabel: 'Evening run, Sun 18 Oct, 5.02 km',
    onPress: fn(),
  },
} satisfies Meta<typeof ActivityRow>;

export default meta;

export const Run: StoryObj<typeof meta> = {};

/** A gap in the GPS track was filled with a street-routed estimate: the distance is approximate. */
export const EstimatedDistance: StoryObj<typeof meta> = {
  args: { type: 'walk', glyph: '🚶', title: 'Morning walk', value: '≈ 3.10 km', detail: '41:02 · 13:14/km' },
};

/** The app passes an SF Symbol as `icon` (Storybook has no SF Symbols, so a stand-in glyph here). */
export const WithIcon: StoryObj<typeof meta> = {
  args: { icon: <Text style={{ fontSize: 20 }}>◆</Text> },
};

/** History list: rows as the app stacks them. */
export const List: StoryObj<typeof meta> = {
  render: (args) => (
    <View style={{ gap: 10 }}>
      <ActivityRow {...args} />
      <ActivityRow {...args} type='cycle' glyph='🚴' title='Ride to work' value='12.4 km' detail='38:10 · 19.5 km/h' />
      <ActivityRow
        {...args}
        type='walk'
        glyph='🚶'
        title='A very long walk name that does not fit on one line'
        value='≈ 3.10 km'
      />
    </View>
  ),
};
