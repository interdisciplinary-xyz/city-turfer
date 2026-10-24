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
import type { T } from '@/i18n';

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

/** A refused account request, worded by `failureMessage` (a rate limit may also start a wait). */
export type AccountRefusal = AccountFailure | NotSignedIn | { kind: 'unavailable' };

/**
 * What a flow does with a use case's answer: go to a step (optionally clearing a code field, with
 * an error to show there, or starting a rate limit's wait without wording it: `wait`), stay and
 * show an error, or word a refusal.
 */
export type FlowOutcome<Step extends string> =
  | {
      kind: 'go';
      step: Step;
      error?: ErrorMessage;
      sentTo?: string;
      clear?: 'code' | 'step-up-code';
      wait?: AccountRefusal;
    }
  | { kind: 'error'; error: ErrorMessage }
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
  /** "On this phone, backed up (42 of 42)" (the screen composes it from Cloud Backup's status). */
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

// --- Copy: the words live in the catalogue (`account`, `errors`); here only their keys ---------

/** An error's message in the `errors` namespace, with its values; worded by the component on render. */
export type ErrorKey = Parameters<T<'errors'>>[0];
export type ErrorMessage = { key: ErrorKey; values?: Record<string, string | number> };

/** The shared field rules' messages (same codes as the API's). */
export const FIELD_ERROR: Record<AccountFieldError, ErrorMessage> = {
  'display-name.too-long': { key: 'field.displayNameTooLong', values: { max: DISPLAY_NAME_MAX } },
  'display-name.invalid': { key: 'field.displayNameInvalid' },
  'email.invalid': { key: 'field.emailInvalid' },
  'email.unchanged': { key: 'field.emailUnchanged' },
  'password.too-short': { key: 'field.passwordTooShort', values: { min: PASSWORD_MIN } },
  'password.too-long': { key: 'field.passwordTooLong', values: { max: PASSWORD_MAX } },
};

export const INVALID_CODE: ErrorMessage = { key: 'invalidCode' };

/** A Retry-After wait in the unit it is said in (seconds under a minute, …), rounded up. */
export type Wait = { unit: 'seconds' | 'minutes' | 'hours'; count: number };

/** How often a Retry-After wait is checked again (timers pause in the background). */
export const COOLDOWN_CHECK_MS = 60_000;
