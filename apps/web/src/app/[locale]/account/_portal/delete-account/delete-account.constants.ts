import type { PortalError } from '@/api/errors';

export type DeleteAccountProps = {
  onDelete: () => void;
  pending: boolean;
  error: PortalError | null;
  /** Start with the confirmation open, for stories. */
  initialOpen?: boolean;
};

/** Typed confirmation: ignores case and surrounding spaces, nothing else. */
export function confirmationMatches(typed: string, word: string): boolean {
  return typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
}
