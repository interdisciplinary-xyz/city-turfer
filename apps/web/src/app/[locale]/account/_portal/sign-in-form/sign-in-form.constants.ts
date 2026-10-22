import type { PortalError } from '@/api/errors';
import type { SignInReason } from '@/api/next-path';

export type SignInStep = 'email' | 'code';

export type SignInAttempt = { email: string; code: string; sharedComputer: boolean };

export type SignInFormProps = {
  /** `POST /v1/auth/codes`; rejects with a PortalError. */
  onRequestCode: (email: string) => Promise<unknown>;
  /** `POST /v1/auth/sign-in`; resolves once signed in (the page then leaves), rejects with a PortalError. */
  onSignIn: (attempt: SignInAttempt) => Promise<unknown>;
  /** Why the visitor landed here (`?reason=`), shown as a calm notice. */
  reason?: SignInReason | null;
  /** Start values, for stories. */
  initialStep?: SignInStep;
  initialEmail?: string;
};

/** Sign-in codes are six digits (POST /v1/auth/codes). */
export const CODE_LENGTH = 6;

/** Keeps the digits of whatever was typed or pasted ("493 027", "Your code: 493027"), at most six. */
export function sanitizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/**
 * The two things a 429 can block, each on its own: asking for a code (send and resend) and
 * signing in with one. The API limits codes per address (1 a minute, 3 per 10 minutes, 10 a day)
 * while a mailed code stays valid for 10 minutes, so a refused resend must not lock "Sign in".
 */
export type SignInAction = 'code' | 'sign-in';

export type SignInFailure = { action: SignInAction; error: PortalError };

export type RateLimitState = {
  /** Until when (ms since epoch) each action is blocked by `Retry-After`, or null. */
  blocks: Record<SignInAction, number | null>;
  /** The last failure, shown as the alert. */
  failure: SignInFailure | null;
  /** A block that came with the alert has run out: say "you can try again" in its place. */
  canRetry: boolean;
};

export const INITIAL_RATE_LIMIT_STATE: RateLimitState = {
  blocks: { code: null, 'sign-in': null },
  failure: null,
  canRetry: false,
};

/** A new attempt: the old alert goes; the blocks stay. */
export function onAttempt(state: RateLimitState): RateLimitState {
  return { ...state, failure: null, canRetry: false };
}

/** `action` failed: show the error, and block only that action for `Retry-After`. */
export function onFailure(
  state: RateLimitState,
  action: SignInAction,
  error: PortalError,
  now: number
): RateLimitState {
  const blocks =
    error.retryAfterSeconds === null
      ? state.blocks
      : { ...state.blocks, [action]: now + error.retryAfterSeconds * 1000 };
  return { blocks, failure: { action, error }, canRetry: false };
}

/** The block of `action` ran out: lift it, and swap its rate-limit alert for "you can try again". */
export function onBlockEnded(state: RateLimitState, action: SignInAction): RateLimitState {
  if (state.blocks[action] === null) {
    return state;
  }
  const blocks = { ...state.blocks, [action]: null };
  const ownAlert = state.failure?.action === action && state.failure.error.retryAfterSeconds !== null;
  return ownAlert ? { blocks, failure: null, canRetry: true } : { ...state, blocks };
}

/** Whole seconds left until `until` (ms since epoch); 0 when null or past. */
export function secondsUntil(until: number | null, now: number): number {
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}
