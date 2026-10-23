import { ON_TYPE_COLOR, TYPE_COLOR } from '@cityturfer/brand';
import { Button } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

const meta = {
  title: 'App/Button',
  component: Button,
  args: { label: 'Start a walk', onPress: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Full-width call to action. Accent fill by default; the label is the palette's `onAccent`: night here (light, 5.5:1), white in the app (dark).",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

export const Primary: StoryObj<typeof meta> = {};

/** An activity colour as the fill, with its own label colour (`ON_TYPE_COLOR`: night on all three). */
export const ActivityColour: StoryObj<typeof meta> = {
  args: { label: 'Start a ride', color: TYPE_COLOR.cycle, textColor: ON_TYPE_COLOR.cycle },
};

export const Busy: StoryObj<typeof meta> = { args: { label: 'Saving', busy: true } };

export const Disabled: StoryObj<typeof meta> = { args: { label: 'Finish', disabled: true } };
