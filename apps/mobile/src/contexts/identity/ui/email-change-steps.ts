import type { ConfirmEmailChangeResult, RequestEmailChangeResult } from '@/contexts/identity';

import { type AccountRefusal, EMAIL_COPY, FIELD_ERROR_TEXT, INVALID_CODE } from './account-settings.constants';
import type { EmailOutcome } from './email-change-flow.constants';

/** Step 1: the code to the current address was sent (or refused). */
export function afterStepUpCode(r: { kind: 'sent' } | AccountRefusal): EmailOutcome {
  return r.kind === 'sent'
    ? { kind: 'go', step: 'current-code', clear: 'step-up-code' }
    : { kind: 'refused', failure: r };
}

/**
 * Step 2: the new address with the step-up code. The server checks that code only now, so a wrong
 * one goes back to step 1's field (cleared) with the error there.
 */
export function afterEmailChangeRequest(r: RequestEmailChangeResult): EmailOutcome {
  switch (r.kind) {
    case 'sent':
      return { kind: 'go', step: 'new-code', sentTo: r.newEmail, clear: 'code' };
    case 'invalid-code':
      return { kind: 'go', step: 'current-code', clear: 'step-up-code', error: INVALID_CODE };
    case 'field-error':
      return { kind: 'error', error: FIELD_ERROR_TEXT[r.code] };
    default:
      return { kind: 'refused', failure: r };
  }
}

/** Step 3: the code from the new inbox. */
export function afterEmailConfirm(r: ConfirmEmailChangeResult, sentTo: string): EmailOutcome {
  switch (r.kind) {
    case 'changed':
      return { kind: 'go', step: 'done' };
    case 'invalid-code':
      return { kind: 'error', error: EMAIL_COPY.newInvalid(sentTo) };
    case 'email-taken':
      return { kind: 'error', error: EMAIL_COPY.taken };
    case 'field-error':
      return { kind: 'error', error: FIELD_ERROR_TEXT[r.code] };
    default:
      return { kind: 'refused', failure: r };
  }
}
