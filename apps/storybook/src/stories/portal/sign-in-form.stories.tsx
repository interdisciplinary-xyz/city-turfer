import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { SignInForm } from '@/app/[locale]/account/_portal/sign-in-form';

import { after, ERRORS } from './fixtures';

const meta = {
  title: 'Portal/SignInForm',
  component: SignInForm,
  globals: { scheme: 'light' },
  args: { onRequestCode: after(600, 'ok'), onSignIn: after(800, ERRORS.wrongCode), reason: null },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Sign-in by e-mailed code. Neutral copy after the e-mail step (no account enumeration), one numeric one-time-code field with paste, the shared-computer box and the cookie line. Here the code step always answers "wrong code".',
      },
    },
  },
} satisfies Meta<typeof SignInForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmailStep: Story = {};

export const CodeStep: Story = { args: { initialStep: 'code', initialEmail: 'walker@e2e.cityturfer.test' } };

export const RateLimited: Story = {
  name: 'Rate limited (429 countdown)',
  args: { onRequestCode: after(300, ERRORS.rateLimited) },
  parameters: { docs: { description: { story: 'Send the code: the API answers 429 with Retry-After 45 s.' } } },
};

export const AfterSignOut: Story = { args: { reason: 'signed-out' } };

export const SessionEnded: Story = { args: { reason: 'expired' } };

export const AccountDeleted: Story = { args: { reason: 'deleted' } };
