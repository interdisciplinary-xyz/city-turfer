import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { DeleteAccount } from '@/app/[locale]/account/_portal/delete-account';

import { ERRORS } from './fixtures';

const meta = {
  title: 'Portal/DeleteAccount',
  component: DeleteAccount,
  args: { onDelete: () => undefined, pending: false, error: null },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Two steps: open, then type the confirmation word. Says "Everything is still on your phone" first.',
      },
    },
  },
} satisfies Meta<typeof DeleteAccount>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Confirming: Story = { args: { initialOpen: true } };
export const Deleting: Story = { args: { initialOpen: true, pending: true } };
export const Failed: Story = { args: { initialOpen: true, error: ERRORS.generic } };
