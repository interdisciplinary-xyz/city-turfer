import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { StoreButtons } from '@/app/[locale]/store-buttons';

const meta = {
  title: 'Website/StoreButtons',
  component: StoreButtons,
  args: { apkUrl: null },
  parameters: {
    docs: {
      description: {
        component: 'Download links. The APK URL comes from NEXT_PUBLIC_ANDROID_APK_URL; without it both say "soon".',
      },
    },
  },
} satisfies Meta<typeof StoreButtons>;

export default meta;

export const ComingSoon: StoryObj<typeof meta> = {};

export const AndroidAvailable: StoryObj<typeof meta> = {
  args: { apkUrl: 'https://example.invalid/cityturfer.apk' },
};
