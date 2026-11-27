import { Toast } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

const meta = {
  title: 'App/Toast',
  component: Toast,
  args: { variant: 'success', message: 'Backed up. Your activities are safe in the cloud.' },
  parameters: {
    docs: {
      description: {
        component:
          'A short message about an action the Turfer started, for results the screen does not show by itself. Success (accent, check) or error (danger, exclamation): the mark says which, never colour alone. Errors are an assertive alert, successes a polite live region. In the app the toast host (`apps/mobile/src/ui-kit/toast-provider.tsx`) places it under the status bar, queues it and closes it after a few seconds.',
      },
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;

export const Success: StoryObj<typeof meta> = {};

export const Failure: StoryObj<typeof meta> = {
  args: { variant: 'error', message: 'Something went wrong. Try again.' },
};

/** Offline: an expected error, worded, not reported. */
export const Offline: StoryObj<typeof meta> = {
  args: { variant: 'error', message: 'No connection. Try again when you’re online.' },
};

/** Tap to close (the app's host passes `onDismiss`): a button for screen readers, with a hint. */
export const Dismissable: StoryObj<typeof meta> = {
  args: { variant: 'success', message: 'Activity deleted.', onDismiss: fn(), dismissHint: 'Close' },
};

/** Polish copy runs longer: the message wraps, the mark stays centred. */
export const LongPolish: StoryObj<typeof meta> = {
  args: {
    variant: 'error',
    message: 'Brak połączenia. Spróbuj ponownie, gdy będziesz online.',
    onDismiss: fn(),
    dismissHint: 'Zamknij',
  },
};
