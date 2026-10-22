import type { User } from '@/contexts/identity';
import { shownName } from '@/ui-kit/format';

import { accountRows } from '../account-rows';
import { failureText, FIELD_ERROR_TEXT, VALUE } from '../account-settings.constants';

const account: User = { id: 'a-u1' as User['id'], email: 'ola@example.com', displayName: 'ola', accountId: 'u1' };
const local: User = { id: 'demo' as User['id'], email: 'demo@cityturfer.com', displayName: 'Ola', name: 'Ola' };

describe('Me › Account rows', () => {
  it('an account, answered: name, email, password with its date, both sign-ins', () => {
    const r = accountRows(account, {
      status: 'ready',
      settings: {
        kind: 'account',
        email: 'ola@example.com',
        name: 'Ola',
        hasPassword: true,
        passwordChangedAt: Date.UTC(2026, 9, 20, 12),
      },
    });
    expect(r.name).toEqual({ value: 'Ola', enabled: true });
    expect(r.email).toEqual({ value: 'ola@example.com', enabled: true });
    expect(r.password.value).toMatch(/^Set · .*2026/);
    expect(r.password.enabled).toBe(true);
    expect(r.signIn).toBe('Email code · account password');
    expect(r.retry).toBe(false);
  });

  it('an account without a password or name', () => {
    const r = accountRows(account, {
      status: 'ready',
      settings: { kind: 'account', email: 'ola@example.com', name: null, hasPassword: false, passwordChangedAt: null },
    });
    expect(r.name.value).toBe(VALUE.notSet);
    expect(r.password.value).toBe(VALUE.notSet);
    expect(r.signIn).toBe('Email code');
  });

  it('offline: the editable rows need internet and are disabled; nothing opens', () => {
    const r = accountRows(account, { status: 'offline' });
    expect([r.name, r.email, r.password]).toEqual([
      { value: 'Needs internet', enabled: false },
      { value: 'Needs internet', enabled: false },
      { value: 'Needs internet', enabled: false },
    ]);
    expect(r.retry).toBe(true);
  });

  it('while asking: what the phone knows, nothing opens yet', () => {
    const r = accountRows({ ...account, name: 'Ola' }, { status: 'loading' });
    expect(r.name).toEqual({ value: 'Ola', enabled: false });
    expect(r.email).toEqual({ value: 'ola@example.com', enabled: false });
    expect(r.password).toEqual({ value: VALUE.checking, enabled: false });
    expect(r.retry).toBe(false);
  });

  it('signed out on the server: sign in again', () => {
    expect(accountRows(account, { status: 'failed', reason: 'auth' }).email.value).toBe(VALUE.signInAgain);
    expect(accountRows(account, { status: 'failed', reason: 'unavailable' }).email.value).toBe(VALUE.couldNotLoad);
  });

  it('a local profile: the name only (also offline); email and password invite an account', () => {
    for (const state of [
      { status: 'loading' as const },
      { status: 'ready' as const, settings: { kind: 'local' as const, name: 'Ola' } },
    ]) {
      const r = accountRows(local, state);
      expect(r.name).toEqual({ value: 'Ola', enabled: true });
      expect(r.email).toEqual({ value: VALUE.createAccount, enabled: false });
      expect(r.password).toEqual({ value: VALUE.createAccount, enabled: false });
      expect(r.signIn).toBe('Local profile on this phone');
      expect(r.retry).toBe(false);
    }
  });
});

describe('account copy', () => {
  it('shows the name or "You", never an id or an email', () => {
    expect(shownName(account)).toBe('You');
    expect(shownName({ ...account, name: null })).toBe('You');
    expect(shownName(local)).toBe('Ola');
    expect(shownName(null)).toBe('You');
  });

  it('every field rule and failure has plain words', () => {
    expect(Object.values(FIELD_ERROR_TEXT).every((t) => t.length > 0)).toBe(true);
    expect(failureText({ kind: 'rate-limited', retryAfterS: 90 })).toBe('Too many tries. Wait 2 min and try again.');
    expect(failureText({ kind: 'rate-limited', retryAfterS: null })).toMatch(/few minutes/);
    expect(failureText({ kind: 'offline' })).toMatch(/nothing was changed/);
    expect(failureText({ kind: 'not-signed-in' })).toBe(failureText({ kind: 'auth' }));
  });
});
