import type { FlowOutcome } from './account-settings.constants';

/** The email change's steps: code to the current address, the new address, its code, done. */
export type EmailChangeStep = 'start' | 'current-code' | 'new-email' | 'new-code' | 'done';

export type EmailOutcome = FlowOutcome<EmailChangeStep>;
