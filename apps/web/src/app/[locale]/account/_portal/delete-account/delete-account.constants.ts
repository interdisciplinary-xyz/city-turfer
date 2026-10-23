import type { PortalError } from '@/api/errors';

export type DeleteAccountProps = {
  onDelete: () => void;
  pending: boolean;
  error: PortalError | null;
  /** Start with the confirmation open, for stories. */
  initialOpen?: boolean;
};

/** Upper case without accents, so "usun" on a keyboard without Polish letters matches "USUŃ". */
function fold(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase();
}

/** Typed confirmation: ignores case, accents and surrounding spaces, nothing else. */
export function confirmationMatches(typed: string, word: string): boolean {
  return fold(typed) === fold(word);
}
