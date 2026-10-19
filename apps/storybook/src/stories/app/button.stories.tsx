import { DARK, TYPE_COLOR } from '@cityturfer/brand';
import { Button } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

const meta = {
  title: 'App/Button',
  component: Button,
  args: { label: 'Start a walk', onPress: fn() },
  parameters: { docs: { description: { component: 'Full-width call to action. Accent fill by default.' } } },
} satisfies Meta<typeof Button>;

export default meta;

export const Primary: StoryObj<typeof meta> = {};

export const ActivityColour: StoryObj<typeof meta> = {
  args: { label: 'Start a ride', color: TYPE_COLOR.cycle, textColor: DARK.bg },
};

export const Busy: StoryObj<typeof meta> = { args: { label: 'Saving', busy: true } };

export const Disabled: StoryObj<typeof meta> = { args: { label: 'Finish', disabled: true } };
