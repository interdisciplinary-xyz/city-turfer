import { TIER_COLOR } from '@cityturfer/brand';
import { Card, usePalette } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text } from 'react-native';

function Body({ title, text }: { title: string; text: string }) {
  const p = usePalette();
  return (
    <>
      <Text style={{ color: p.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      <Text style={{ color: p.muted, fontSize: 13, marginTop: 4 }}>{text}</Text>
    </>
  );
}

const meta = {
  title: 'App/Card',
  component: Card,
  args: { children: <Body title='This week' text='3 activities · 14.2 km · 2 h 05 min' /> },
} satisfies Meta<typeof Card>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

/** As the "turf gained" card on an activity: glow outline. */
export const Highlighted: StoryObj<typeof meta> = {
  args: {
    style: { borderColor: TIER_COLOR.glowing, borderWidth: 1.5 },
    children: <Body title='+0.12 km² new turf' text='340 cells reinforced' />,
  },
};
