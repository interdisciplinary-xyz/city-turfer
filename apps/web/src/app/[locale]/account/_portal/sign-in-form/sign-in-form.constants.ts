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
