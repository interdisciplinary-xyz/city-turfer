import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { ExportPanel } from '@/app/[locale]/account/_portal/export-panel';

import { ERRORS, exportJob, USER } from './fixtures';

const meta = {
  title: 'Portal/ExportPanel',
  component: ExportPanel,
  globals: { scheme: 'light' },
  args: { email: USER.email, locale: 'en', job: null, onRequest: () => undefined, pending: false, error: null },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ExportPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Requesting: Story = { args: { pending: true } };
export const Pending: Story = { args: { job: exportJob('pending') } };
export const Sent: Story = { args: { job: exportJob('ready') } };
export const Failed: Story = { args: { job: exportJob('failed') } };
export const OncePerDay: Story = { name: 'Once a day (429)', args: { error: ERRORS.exportDaily } };
export const NoEmail: Story = { args: { email: null, error: null } };
