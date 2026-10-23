import type { ErrorMessage } from './account-settings.constants';
import type { SignInFocus, SignInStep } from './sign-in-steps.constants';

/**
 * "Use a password instead" (on) or "Use an email code instead" (off). On: the password step, the
 * keyboard on the email field while it is empty, otherwise on the password.
 */
export function switchSignIn(
  usePassword: boolean,
  email: string
): { step: SignInStep; chosePassword: boolean; focus: SignInFocus } {
  if (!usePassword) {
    return { step: 'email', chosePassword: false, focus: null };
  }
  return { step: 'password', chosePassword: true, focus: email.trim() ? 'password' : 'email' };
}

/** Return on the email field: with a chosen password it moves to the password; otherwise it sends. */
export function onEmailSubmit(chosePassword: boolean): 'focus-password' | 'send' {
  return chosePassword ? 'focus-password' : 'send';
}

/** Editing the email after it was sent starts again; with a chosen password, both fields stay. */
export function emailEditRestarts(step: SignInStep, chosePassword: boolean): boolean {
  return step !== 'email' && !chosePassword;
}

/** A wrong password: a chosen account password also says how to get one. */
export function wrongPasswordMessage(chosePassword: boolean): ErrorMessage {
  return { key: chosePassword ? 'wrongChosenPassword' : 'wrongPassword' };
}
