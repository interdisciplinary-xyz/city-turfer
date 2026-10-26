import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { ErrorMessage } from '@/app/[locale]/account/_portal/error-message';
import { Notice } from '@/app/[locale]/account/_portal/notice';
import { Unreachable } from '@/app/[locale]/account/_portal/unreachable';

import { ERRORS } from './fixtures';

/** The portal's messages: an empty-state notice, the API-unreachable state, and mapped errors. */
function Messages() {
  return (
    <div className='portal-page'>
      <Notice>
        <p>Your turf lives on your phone. Nothing is backed up yet.</p>
      </Notice>
      <Unreachable onRetry={() => undefined} />
      <ErrorMessage error={ERRORS.wrongCode} />
      <ErrorMessage error={ERRORS.rateLimited} />
      <ErrorMessage error={ERRORS.generic} />
      <ErrorMessage error={ERRORS.unreachable} />
    </div>
  );
}

const meta = {
  title: 'Portal/Messages',
  component: Messages,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Messages>;

export default meta;

export const All: StoryObj<typeof meta> = {};
