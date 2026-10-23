import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { DevicesPanel } from '@/app/[locale]/account/_portal/devices-panel';

import { ERRORS, SESSIONS } from './fixtures';

const meta = {
  title: 'Portal/DevicesPanel',
  component: DevicesPanel,
  globals: { scheme: 'light' },
  args: {
    sessions: SESSIONS,
    loading: false,
    locale: 'en',
    onRevoke: () => undefined,
    onRevokeScope: () => undefined,
    pending: null,
    error: null,
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Signed-in devices. D11: "everywhere" includes phones, so both scope buttons say so and ask once more. No IP, device name or location exists to show.',
      },
    },
  },
} satisfies Meta<typeof DevicesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeDevices: Story = {};
export const ConfirmEverywhereElse: Story = { args: { initialConfirm: 'others' } };
export const ConfirmEverywhere: Story = { args: { initialConfirm: 'all' } };
export const SigningOutOne: Story = { args: { pending: { id: 'sess_phone' } } };
export const OnlyThisBrowser: Story = { args: { sessions: SESSIONS.slice(0, 1) } };
export const Loading: Story = { args: { sessions: null, loading: true } };
export const Unavailable: Story = { args: { sessions: null } };
export const Failed: Story = { args: { error: ERRORS.generic } };
