import { DomainError } from '../../../shared-kernel';
import { email } from './user';

/**
 * The rules for what a Turfer may change about their account: name, e-mail, password
 * (docs/decisions/account-settings-2026-10-22.md, AC2 and AC6). One copy, used by the API to
 * validate and by the phone and the web portal for instant feedback, so all three agree.
 * The error codes are the API's problem `code`s.
 */

export const DISPLAY_NAME_MAX = 40;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export type AccountFieldError =
  | 'display-name.too-long'
  | 'display-name.invalid'
  | 'email.invalid'
  | 'email.unchanged'
  | 'password.too-short'
  | 'password.too-long';

// Control characters (C0, DEL, C1) and the line/paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

const codePoints = (s: string) => [...s].length;

/**
 * A display name: trimmed, NFC, inner runs of whitespace collapsed to one space, at most 40 code
 * points, no control characters. `null` means "no name" (an empty or blank input clears it); the
 * UIs then show "You".
 */
export function displayName(raw: string): string | null {
  // Tabs and line breaks count as whitespace (collapsed below); any other control character is refused.
  if (CONTROL.test(raw.replace(/[\t\n\r]/g, ' '))) {
    throw new DomainError('display-name.invalid');
  }
  const value = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (value === '') {
    return null;
  }
  if (codePoints(value) > DISPLAY_NAME_MAX) {
    throw new DomainError('display-name.too-long');
  }
  return value;
}

/** The new address for an e-mail change: valid, lower-cased, and not the current one. */
export function newEmail(raw: string, current: string | null): string {
  const { value } = email(raw);
  if (current !== null && value === current.trim().toLowerCase()) {
    throw new DomainError('email.unchanged');
  }
  return value;
}

/**
 * A new account password (NIST SP 800-63B): 12 to 128 code points, any characters including
 * spaces, no composition rules, not trimmed. The breached-password check is the API's (it needs
 * the network). Returns the password unchanged.
 */
export function newPassword(raw: string): string {
  const n = codePoints(raw);
  if (n < PASSWORD_MIN) {
    throw new DomainError('password.too-short');
  }
  if (n > PASSWORD_MAX) {
    throw new DomainError('password.too-long');
  }
  return raw;
}

/** The field error of a thrown value, or null when it isn't one of these rules. */
export function accountFieldError(e: unknown): AccountFieldError | null {
  if (!(e instanceof DomainError)) {
    return null;
  }
  const codes: readonly string[] = [
    'display-name.too-long',
    'display-name.invalid',
    'email.invalid',
    'email.unchanged',
    'password.too-short',
    'password.too-long',
  ];
  return codes.includes(e.code) ? (e.code as AccountFieldError) : null;
}
