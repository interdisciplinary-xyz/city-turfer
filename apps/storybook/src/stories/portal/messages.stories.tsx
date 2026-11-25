import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { ErrorMessage, Notice, RenderError, Unreachable } from '@/domains/portal';

import { ERRORS } from './fixtures';

/**
 * The portal's messages: an empty-state notice, the API-unreachable state, mapped errors, and the
 * error boundary's fallback (a page that crashed while rendering).
 */
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

/** The portal root's error boundary (`account/error.tsx`): generic copy and a retry, no frame. */
export const RenderCrash: StoryObj<typeof meta> = {
  render: () => <RenderError onRetry={() => undefined} />,
};
