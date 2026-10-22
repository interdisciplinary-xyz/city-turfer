import type { FlowOutcome, PasswordAction } from './account-settings.constants';

/** The password flow's steps: ask for a code, the code (and the new password), done. */
export type PasswordStep = 'start' | 'code' | 'done';

export type PasswordOutcome = FlowOutcome<PasswordStep>;

/** What the password screen opens: a flow, or the note that there's no password to remove. */
export type PasswordScreenAction = PasswordAction | 'nothing-to-remove';
