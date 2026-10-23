import { INVALID_CODE, PASSWORD_COPY } from '../account-settings.constants';
import { afterPasswordSave, afterPasswordStepUp, passwordActionFor, savePassword } from '../password-steps';

describe('account password: set, change or remove', () => {
  it('set or change comes from hasPassword, whatever the route asked; remove needs a password', () => {
    expect(passwordActionFor('change', false)).toBe('set');
    expect(passwordActionFor('set', false)).toBe('set');
    expect(passwordActionFor(undefined, false)).toBe('set');
    expect(passwordActionFor('set', true)).toBe('change');
    expect(passwordActionFor('change', true)).toBe('change');
    expect(passwordActionFor('bogus', true)).toBe('change');
    expect(passwordActionFor('remove', true)).toBe('remove');
    expect(passwordActionFor('remove', false)).toBe('nothing-to-remove');
  });

  it('set and change send the new password with the code; remove sends only the code', async () => {
    const actions = {
      setPassword: jest.fn(async () => ({ kind: 'saved' as const })),
      removePassword: jest.fn(async () => ({ kind: 'removed' as const })),
    };
    await savePassword(actions, 'set', 'walk the city', '123456');
    await savePassword(actions, 'change', 'ride the city', '654321');
    expect(actions.setPassword.mock.calls).toEqual([
      ['walk the city', '123456'],
      ['ride the city', '654321'],
    ]);
    expect(actions.removePassword).not.toHaveBeenCalled();
    await savePassword(actions, 'remove', 'ignored', '111111');
    expect(actions.removePassword.mock.calls).toEqual([['111111']]);
  });

  it('the answers: done, or what to fix; a lost sign-in is a refusal', () => {
    expect(afterPasswordStepUp({ kind: 'sent' })).toEqual({ kind: 'go', step: 'code', clear: 'code' });
    expect(afterPasswordSave({ kind: 'saved' })).toEqual({ kind: 'go', step: 'done' });
    expect(afterPasswordSave({ kind: 'removed' })).toEqual({ kind: 'go', step: 'done' });
    expect(afterPasswordSave({ kind: 'invalid-code' })).toEqual({ kind: 'error', error: INVALID_CODE });
    expect(afterPasswordSave({ kind: 'breached' })).toEqual({ kind: 'error', error: PASSWORD_COPY.breached });
    expect(afterPasswordSave({ kind: 'field-error', code: 'password.too-long' })).toMatchObject({ kind: 'error' });
    expect(afterPasswordSave({ kind: 'not-signed-in' })).toEqual({
      kind: 'refused',
      failure: { kind: 'not-signed-in' },
    });
  });
});
