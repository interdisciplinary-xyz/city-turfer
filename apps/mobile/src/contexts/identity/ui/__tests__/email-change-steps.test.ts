import { translator } from '@/i18n/translator';

import { INVALID_CODE } from '../account-settings.constants';
import { afterEmailChangeRequest, afterEmailConfirm, afterStepUpCode } from '../email-change-steps';

describe('email change: what each answer leads to', () => {
  it('step 1: the step-up code sent → its field (cleared); a rate limit is a refusal', () => {
    expect(afterStepUpCode({ kind: 'sent' })).toEqual({ kind: 'go', step: 'current-code', clear: 'step-up-code' });
    expect(afterStepUpCode({ kind: 'rate-limited', retryAfterS: 60 })).toEqual({
      kind: 'refused',
      failure: { kind: 'rate-limited', retryAfterS: 60 },
    });
  });

  it('step 2: a wrong step-up code goes back to step 1, the field cleared and the error there', () => {
    expect(afterEmailChangeRequest({ kind: 'invalid-code' })).toEqual({
      kind: 'go',
      step: 'current-code',
      clear: 'step-up-code',
      error: INVALID_CODE,
    });
  });

  it('step 2: sent → the new inbox’s code; a field error stays; offline is a refusal', () => {
    expect(afterEmailChangeRequest({ kind: 'sent', newEmail: 'ola@new.example' })).toEqual({
      kind: 'go',
      step: 'new-code',
      sentTo: 'ola@new.example',
      clear: 'code',
    });
    expect(afterEmailChangeRequest({ kind: 'field-error', code: 'email.unchanged' })).toEqual({
      kind: 'error',
      error: { key: 'field.emailUnchanged' },
    });
    expect(translator('errors', 'en')('field.emailUnchanged')).toBe('That’s already your email.');
    expect(afterEmailChangeRequest({ kind: 'offline' })).toEqual({ kind: 'refused', failure: { kind: 'offline' } });
  });

  it('step 3: changed → done; a wrong code or a taken address stays with its message', () => {
    expect(afterEmailConfirm({ kind: 'changed', user: {} as never }, 'ola@new.example')).toEqual({
      kind: 'go',
      step: 'done',
    });
    expect(afterEmailConfirm({ kind: 'invalid-code' }, 'ola@new.example')).toEqual({
      kind: 'error',
      error: { key: 'emailCodeInvalid', values: { email: 'ola@new.example' } },
    });
    expect(translator('errors', 'en')('emailCodeInvalid', { email: 'ola@new.example' })).toBe(
      'That code didn’t work. Check the latest email to ola@new.example, or start again.'
    );
    expect(afterEmailConfirm({ kind: 'email-taken' }, 'ola@new.example')).toEqual({
      kind: 'error',
      error: { key: 'emailTaken' },
    });
    expect(afterEmailConfirm({ kind: 'auth' }, 'ola@new.example')).toEqual({
      kind: 'refused',
      failure: { kind: 'auth' },
    });
  });
});
