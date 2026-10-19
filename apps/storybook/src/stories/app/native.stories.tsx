import { TurfLegend } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';

import { NativePlaceholder } from '../../placeholders/native-placeholder';

const meta = {
  title: 'App/Native (placeholders)',
  component: NativePlaceholder,
  parameters: {
    docs: {
      description: {
        component:
          'These parts need native modules and only run in a dev build on a simulator or phone (`mobile-testing` skill).',
      },
    },
  },
} satisfies Meta<typeof NativePlaceholder>;

export default meta;

export const TurfMap: StoryObj<typeof meta> = {
  args: {
    title: 'Turf Map',
    module: 'MapLibre',
    note: 'Dark OpenFreeMap tiles with glowing turf cells and tracks (contexts/territory/ui/turf-map-view.tsx).',
    height: 420,
  },
  render: (args) => (
    <View style={{ gap: 12 }}>
      <NativePlaceholder {...args} />
      <TurfLegend compact style={{ width: 160, alignSelf: 'flex-end' }} />
    </View>
  ),
};

export const LiveRecording: StoryObj<typeof meta> = {
  args: {
    title: 'Live recording',
    module: 'expo-location + expo-task-manager',
    note: 'Background GPS, live map and stats (contexts/recording/ui/record-view.tsx). Replay a GPX route into a simulator to see it.',
  },
};

export const AppleHealth: StoryObj<typeof meta> = {
  args: {
    title: 'Apple Health',
    module: 'HealthKit',
    note: 'Import and save workouts with routes (contexts/health-sync/ui/apple-health-card.tsx). iOS only.',
    height: 160,
  },
};
