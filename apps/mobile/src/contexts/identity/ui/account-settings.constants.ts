import type { ReactNode } from 'react';
import type { TextInputProps } from 'react-native';

import {
  type AccountFailure,
  type AccountFieldError,
  type AccountSettings,
  DISPLAY_NAME_MAX,
  type NotSignedIn,
  PASSWORD_MAX,
  PASSWORD_MIN,
  type User,
} from '@/contexts/identity';

/** What Me › Account knows about the account right now. */
export type AccountSettingsState =
  | { status: 'loading' }
  /**
   * `refreshing`: asked again (the screen came back into view). What depends on `hasPassword` may
   * be out of date (e.g. right after removing the password), so those rows wait for the answer.
   */
  | { status: 'ready'; settings: AccountSettings; refreshing?: boolean }
  /** No connection: the editable rows show "Needs internet"; nothing is queued. `retrying`: asked again. */
  | { status: 'offline'; retrying?: boolean }
  | {
      status: 'failed';
      reason: Exclude<AccountFailure, { kind: 'offline' }>['kind'] | NotSignedIn['kind'];
      retrying?: boolean;
    };

/** The server's answer for Me › Account, or `unavailable` when asking it threw. */
export type AccountSettingsAnswer = AccountSettings | NotSignedIn | AccountFailure | { kind: 'unavailable' };

/** A refused account request, worded by `failureText` (a rate limit may also start a wait). */
export type AccountRefusal = AccountFailure | NotSignedIn | { kind: 'unavailable' };

/**
 * What a flow does with a use case's answer: go to a step (optionally clearing a code field, with
 * an error to show there), stay and show an error, or word a refusal.
 */
export type FlowOutcome<Step extends string> =
  | { kind: 'go'; step: Step; error?: string; sentTo?: string; clear?: 'code' | 'step-up-code' }
  | { kind: 'error'; error: string }
  | { kind: 'refused'; failure: AccountRefusal };

/** The signed-in account's settings, once the server answered (the deep-linked flows need them). */
export type AccountReady = Extract<AccountSettings, { kind: 'account' }>;

export type PasswordAction = 'set' | 'change' | 'remove';

export type SettingsRowProps = {
  label: string;
  value: string;
  testID: string;
  /** Absent: an information row (not a control). */
  onPress?: () => void;
  disabled?: boolean;
  /** Read after the label and value by VoiceOver / TalkBack. */
  accessibilityHint?: string;
  /** Draws the hairline above the row (every row but the first). */
  divider?: boolean;
};

export type AccountOverviewProps = {
  user: User;
  state: AccountSettingsState;
  /** "On this phone, backed up (42 of 42)", from Cloud Backup (the screen composes it). */
  dataText: string;
  onName: () => void;
  onEmail: () => void;
  onPassword: () => void;
  onRetry: () => void;
};

export type AccountFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  testID: string;
  /** Shown under the field (and announced); null: none. */
  error?: string | null;
  /** Shown under the field when there is no error. */
  hint?: string;
  /** The 6-digit code look: large, spaced, number pad, one-time-code autofill. */
  code?: boolean;
};

export type AccountGateProps = {
  /** Rendered once the server answered for a signed-in account (never for a local profile). */
  children: (account: AccountReady) => ReactNode;
};

export type NameFormProps = { onDone: () => void };
export type EmailChangeFlowProps = { onDone: () => void };
export type PasswordFlowProps = { action: PasswordAction; onDone: () => void };

// --- Copy (CityTurfer voice: plain, calm; "Email" as in the rest of the app) -------------------

export const ROW = {
  name: 'Name',
  email: 'Email',
  password: 'Account password',
  signIn: 'Sign-in',
  data: 'Data',
} as const;

export const VALUE = {
  notSet: 'Not set',
  set: 'Set',
  setOn: (day: string) => `Set · ${day}`,
  needsInternet: 'Needs internet',
  checking: 'Checking…',
  createAccount: 'Create an account to back up and sign in anywhere',
  localProfile: 'Local profile on this phone',
  codeOnly: 'Email code',
  codeAndPassword: 'Email code · account password',
  signInAgain: 'Sign in again to change this',
  couldNotLoad: 'Couldn’t load. Try again',
} as const;

export const HINT = {
  name: 'Changes the name shown in the app',
  email: 'Starts changing your email',
  password: 'Opens your account password options',
} as const;

export const RETRY = 'Try again';

/** The account flows opened without an account to change (a local profile, or a deep link). */
export const GATE_COPY = {
  local: 'This is a local profile on this phone, so there’s no account email or password to change.',
  noPassword: 'There’s no account password to remove. You sign in with an email code.',
  back: 'Back',
} as const;

export const NAME_COPY = {
  label: 'Your name',
  save: 'Save',
  local: 'Optional. Kept on this phone only.',
  account: 'Optional. Saved to your CityTurfer account.',
  saved: 'Saved',
} as const;

export const NAME_ERROR: Record<'display-name.too-long' | 'display-name.invalid', string> = {
  'display-name.too-long': `Keep it to ${DISPLAY_NAME_MAX} characters.`,
  'display-name.invalid': 'That name has characters we can’t show.',
};

export const CODE_COPY = {
  label: 'Code',
  resend: 'Send a new code',
  sendCode: 'Send code',
  continue: 'Continue',
} as const;

export const EMAIL_COPY = {
  intro: (current: string) =>
    `To keep your account safe, we’ll first email a code to your current address, ${current}.`,
  currentSent: (current: string) => `We emailed a 6-digit code to ${current}. It works for 10 minutes.`,
  newLabel: 'New email',
  newHint: 'We’ll email a code there to check it’s yours.',
  sendNew: 'Send code to new email',
  newSent: (next: string) => `We emailed a 6-digit code to ${next}. Enter it to finish.`,
  confirm: 'Change email',
  restart: 'Start again',
  done: (next: string) =>
    `Your email is now ${next}. Use it to sign in. Other phones and browsers were signed out; we sent a note to your old address.`,
  doneButton: 'Done',
  taken: 'That email already has a CityTurfer account. Try another one.',
  newInvalid: (next: string) => `That code didn’t work. Check the latest email to ${next}, or start again.`,
} as const;

export const PASSWORD_COPY = {
  intro: {
    set: 'An account password is optional: you can always sign in with an email code instead.',
    change: 'Choose a new account password. Email codes keep working too.',
    remove: 'Without an account password, you sign in with an email code.',
  },
  stepUp: (email: string) => `First we’ll email a code to ${email}, to check it’s you.`,
  sent: (email: string) => `We emailed a 6-digit code to ${email}. It works for 10 minutes.`,
  newLabel: 'New account password',
  newHint: `At least ${PASSWORD_MIN} characters. A few words you’ll remember work well.`,
  save: { set: 'Set account password', change: 'Change account password', remove: 'Remove account password' },
  done: {
    set: 'Your account password is set. Other phones and browsers were signed out.',
    change: 'Your account password has been changed. Other phones and browsers were signed out.',
    remove: 'Your account password has been removed. Sign in with an email code from now on.',
  },
  doneButton: 'Done',
  breached: 'That password appears in leaked password lists, so it’s easy to guess. Choose another one.',
  show: 'Show password',
  hide: 'Hide password',
  actionTitle: 'Account password',
  actionText: 'Change it, or remove it and sign in with email codes only.',
  change: 'Change password',
  remove: 'Remove password',
} as const;

/** The shared field rules' messages (same codes as the API's). */
export const FIELD_ERROR_TEXT: Record<AccountFieldError, string> = {
  ...NAME_ERROR,
  'email.invalid': 'That doesn’t look like an email address.',
  'email.unchanged': 'That’s already your email.',
  'password.too-short': `Use at least ${PASSWORD_MIN} characters.`,
  'password.too-long': `Use at most ${PASSWORD_MAX} characters.`,
};

/** How often a Retry-After wait is checked again (timers pause in the background). */
export const COOLDOWN_CHECK_MS = 60_000;

export const INVALID_CODE = 'That code didn’t work. Check the latest email, or send a new code.';

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * How long to wait, spelled out: seconds under a minute, minutes under an hour, otherwise hours
 * (always rounded up, so the Turfer never tries a moment too early).
 */
export function waitText(retryAfterS: number): string {
  const s = Math.max(1, Math.ceil(retryAfterS));
  if (s < 60) {
    return plural(s, 'second');
  }
  const min = Math.ceil(s / 60);
  if (min < 60) {
    return plural(min, 'minute');
  }
  return plural(Math.ceil(s / 3600), 'hour');
}

/** Why an account request failed, in plain words (nothing was changed or queued). */
export function failureText(f: AccountFailure | NotSignedIn | { kind: 'unavailable' }): string {
  switch (f.kind) {
    case 'offline':
      return 'No connection. Changes to your account need the internet; nothing was changed.';
    case 'rate-limited':
      return f.retryAfterS
        ? `Too many tries. Wait ${waitText(f.retryAfterS)} and try again.`
        : 'Too many tries. Wait a few minutes and try again.';
    case 'auth':
    case 'not-signed-in':
      return 'This phone isn’t signed in to your account any more. Sign out, then sign in with your email.';
    default:
      return 'Our server had a hiccup. Try again in a moment.';
  }
}
