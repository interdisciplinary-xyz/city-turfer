import type { SetPasswordResult } from '@/contexts/identity';

import {
  type AccountRefusal,
  FIELD_ERROR_TEXT,
  INVALID_CODE,
  PASSWORD_COPY,
  type PasswordAction,
} from './account-settings.constants';
import type { PasswordOutcome, PasswordScreenAction } from './password-flow.constants';

/**
 * What the password screen opens, from the server's `hasPassword` (the route's `?action=` only
 * says whether the Turfer asked to remove it): no password → set; a password → change or remove.
 */
export function passwordActionFor(requested: string | undefined, hasPassword: boolean): PasswordScreenAction {
  if (requested === 'remove') {
    return hasPassword ? 'remove' : 'nothing-to-remove';
  }
  return hasPassword ? 'change' : 'set';
}

/** The step-up code was sent (or refused). */
export function afterPasswordStepUp(r: { kind: 'sent' } | AccountRefusal): PasswordOutcome {
  return r.kind === 'sent' ? { kind: 'go', step: 'code', clear: 'code' } : { kind: 'refused', failure: r };
}

type RemoveResult = { kind: 'removed' } | { kind: 'invalid-code' } | AccountRefusal;

/** Set and change both send the new password; remove sends only the code. */
export function savePassword(
  actions: {
    setPassword: (password: string, stepUpCode: string) => Promise<SetPasswordResult>;
    removePassword: (stepUpCode: string) => Promise<RemoveResult>;
  },
  action: PasswordAction,
  draft: string,
  code: string
): Promise<SetPasswordResult | RemoveResult> {
  return action === 'remove' ? actions.removePassword(code) : actions.setPassword(draft, code);
}

/** The save's answer: done, or what to fix (the code, a breached or too long password). */
export function afterPasswordSave(r: SetPasswordResult | RemoveResult): PasswordOutcome {
  switch (r.kind) {
    case 'saved':
    case 'removed':
      return { kind: 'go', step: 'done' };
    case 'invalid-code':
      return { kind: 'error', error: INVALID_CODE };
    case 'breached':
      return { kind: 'error', error: PASSWORD_COPY.breached };
    case 'field-error':
      return { kind: 'error', error: FIELD_ERROR_TEXT[r.code] };
    default:
      return { kind: 'refused', failure: r };
  }
}
