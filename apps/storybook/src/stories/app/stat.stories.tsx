import { Card, Stat } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';

const meta = {
  title: 'App/Stat',
  component: Stat,
  args: { label: 'Distance', value: '5.02', unit: 'km' },
} satisfies Meta<typeof Stat>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Big: StoryObj<typeof meta> = { args: { label: 'Time', value: '28:14', unit: undefined, big: true } };

/** A stats row as on the Record and Stats screens. */
export const InACard: StoryObj<typeof meta> = {
  render: () => (
    <Card>
      <View style={{ flexDirection: 'row' }}>
        <Stat label='Distance' value='5.02' unit='km' />
        <Stat label='Pace' value='5:37' unit='/km' />
        <Stat label='Turf' value='0.12' unit='km²' />
      </View>
    </Card>
  ),
};
