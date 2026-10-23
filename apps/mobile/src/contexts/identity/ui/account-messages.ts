import type { AccountFailure, NotSignedIn } from '@/contexts/identity';

import type { ErrorMessage, Wait } from './account-settings.constants';

/**
 * How long to wait: seconds under a minute, minutes under an hour, otherwise hours (always
 * rounded up, so the Turfer never tries a moment too early). The message says it with its plural.
 */
export function waitFor(retryAfterS: number): Wait {
  const s = Math.max(1, Math.ceil(retryAfterS));
  if (s < 60) {
    return { unit: 'seconds', count: s };
  }
  const min = Math.ceil(s / 60);
  if (min < 60) {
    return { unit: 'minutes', count: min };
  }
  return { unit: 'hours', count: Math.ceil(s / 3600) };
}

const WAIT_KEY = {
  seconds: 'rateLimitedSeconds',
  minutes: 'rateLimitedMinutes',
  hours: 'rateLimitedHours',
} as const;

/** "Too many tries. Wait 2 minutes and try again." (or "a few minutes" without a Retry-After). */
export function rateLimitedMessage(retryAfterS: number | null | undefined): ErrorMessage {
  if (!retryAfterS) {
    return { key: 'rateLimited' };
  }
  const { unit, count } = waitFor(retryAfterS);
  return { key: WAIT_KEY[unit], values: { count } };
}

/** Why an account request failed (nothing was changed or queued). */
export function failureMessage(f: AccountFailure | NotSignedIn | { kind: 'unavailable' }): ErrorMessage {
  switch (f.kind) {
    case 'offline':
      return { key: 'accountOffline' };
    case 'rate-limited':
      return rateLimitedMessage(f.retryAfterS);
    case 'auth':
    case 'not-signed-in':
      return { key: 'signedOut' };
    default:
      return { key: 'server' };
  }
}

/** Why a sign-in request failed. */
export function signInFailureMessage(f: AccountFailure | { kind: 'accounts-unavailable' }): ErrorMessage {
  switch (f.kind) {
    case 'rate-limited':
      return rateLimitedMessage(f.retryAfterS);
    case 'offline':
      return { key: 'signInOffline' };
    case 'accounts-unavailable':
      return { key: 'accountsUnavailable' };
    default:
      return { key: 'server' };
  }
}
