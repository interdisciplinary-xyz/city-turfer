import { ProgressBar } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const meta = {
  title: 'App/ProgressBar',
  component: ProgressBar,
  args: { progress: 0.6, accessibilityLabel: '18 of 30 minutes today', style: { maxWidth: 360 } },
  parameters: {
    docs: {
      description: {
        component:
          'Progress toward a target (the daily goal on the Start tab): an accent fill on a border-coloured track. The accent, never a turf tier’s meaning (ACCENT shares its hex with the glowing tier), never red: a part-filled bar is progress, not a failure. Over the target it stays full.',
      },
    },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Empty: StoryObj<typeof meta> = { args: { progress: 0, accessibilityLabel: '0 of 30 minutes today' } };

export const Met: StoryObj<typeof meta> = { args: { progress: 1, accessibilityLabel: '42 of 30 minutes today' } };
