import type { User } from '@/contexts/identity';
import { translator } from '@/i18n/translator';
import { shownName } from '@/ui-kit/format';

import { failureMessage, signInFailureMessage, waitFor } from '../account-messages';
import { accountRows as rowsIn } from '../account-rows';
import { type ErrorMessage, FIELD_ERROR } from '../account-settings.constants';

const t = translator('account', 'en');
const accountRows = (user: User, state: Parameters<typeof rowsIn>[1]) => rowsIn(user, state, t, 'en-GB');
const VALUE = {
  notSet: 'Not set',
  checking: 'Checking…',
  signInAgain: 'Sign in again to change this',
  couldNotLoad: 'Couldn’t load. Try again',
  createAccount: 'Create an account to back up and sign in anywhere',
};
const say = (m: ErrorMessage, locale: 'en' | 'pl' = 'en') => translator('errors', locale)(m.key, m.values);
const failureText = (f: Parameters<typeof failureMessage>[0], locale: 'en' | 'pl' = 'en') =>
  say(failureMessage(f), locale);

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
    expect(r.password?.value).toBe('Set · 20 Oct 2026');
    expect(r.password?.enabled).toBe(true);
    expect(r.signIn).toBe('Email code · account password');
    expect(r.retry).toBe(false);
  });

  it('an account without a password or name', () => {
    const r = accountRows(account, {
      status: 'ready',
      settings: { kind: 'account', email: 'ola@example.com', name: null, hasPassword: false, passwordChangedAt: null },
    });
    expect(r.name.value).toBe(VALUE.notSet);
    expect(r.password?.value).toBe(VALUE.notSet);
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

  it('asked again after an answer (back from a flow): the password row waits for the fresh answer', () => {
    const r = accountRows(account, {
      status: 'ready',
      refreshing: true,
      settings: { kind: 'account', email: 'ola@example.com', name: 'Ola', hasPassword: true, passwordChangedAt: null },
    });
    expect(r.password).toEqual({ value: VALUE.checking, enabled: false });
    expect(r.signIn).toBe(VALUE.checking);
    expect(r.name.enabled).toBe(true);
    expect(r.email.enabled).toBe(true);
  });

  it('"Try again" tapped: it reads Checking… until the answer, the rows too', () => {
    const r = accountRows(account, { status: 'offline', retrying: true });
    expect(r.retry).toBe(true);
    expect(r.retrying).toBe(true);
    expect(r.password).toEqual({ value: VALUE.checking, enabled: false });
    expect(accountRows(account, { status: 'offline' }).retrying).toBe(false);
    expect(accountRows(account, { status: 'failed', reason: 'unavailable', retrying: true }).email.value).toBe(
      VALUE.checking
    );
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

describe('Me › Account rows: a local profile linked to its own address (admin, demo)', () => {
  const linkedAdmin: User = {
    id: 'admin' as User['id'],
    email: 'admin@cityturfer.com',
    displayName: 'admin',
    name: 'Admin',
    accountId: 'u-admin',
  };
  const ready = {
    status: 'ready' as const,
    settings: {
      kind: 'account' as const,
      email: 'admin@cityturfer.com',
      name: 'Admin',
      hasPassword: false,
      passwordChangedAt: null,
    },
  };

  it('shows the address but never opens the email change; the password row is gone', () => {
    const r = rowsIn(linkedAdmin, ready, t, 'en-GB', true);
    expect(r.emailFixed).toBe(true);
    expect(r.email).toEqual({ value: 'admin@cityturfer.com', enabled: false });
    expect(r.password).toBeNull();
  });

  it('the name and the rest stay as for any account', () => {
    const fixed = rowsIn(linkedAdmin, ready, t, 'en-GB', true);
    const plain = rowsIn(linkedAdmin, ready, t, 'en-GB');
    expect(fixed.name).toEqual({ value: 'Admin', enabled: true });
    expect(fixed.name).toEqual(plain.name);
    expect(fixed.signIn).toBe(plain.signIn);
    expect(fixed.local).toBe(false);
  });

  it('offline it still shows the address itself (nothing to change there anyway)', () => {
    const r = rowsIn(linkedAdmin, { status: 'offline' }, t, 'en-GB', true);
    expect(r.email).toEqual({ value: 'admin@cityturfer.com', enabled: false });
    expect(r.password).toBeNull();
    expect(r.name).toEqual({ value: 'Needs internet', enabled: false });
  });

  it('a real account keeps its email and password rows', () => {
    const r = accountRows(account, { ...ready, settings: { ...ready.settings, email: 'ola@example.com' } });
    expect(r.emailFixed).toBe(false);
    expect(r.email.enabled).toBe(true);
    expect(r.password).not.toBeNull();
  });
});

describe('account copy', () => {
  it('shows the name or "You", never an id or an email', () => {
    expect(shownName(account)).toBe('You');
    expect(shownName({ ...account, name: null })).toBe('You');
    expect(shownName(local)).toBe('Ola');
    expect(shownName(null)).toBe('You');
  });

  it('every field rule and failure has plain words, in both languages', () => {
    for (const m of Object.values(FIELD_ERROR)) {
      expect(say(m)).not.toBe(`field.${m.key}`);
      expect(say(m, 'pl')).not.toBe(say(m));
    }
    expect(say(FIELD_ERROR['password.too-short'])).toBe('Use at least 12 characters.');
    expect(say(FIELD_ERROR['password.too-short'], 'pl')).toBe('Użyj co najmniej 12 znaków.');
    expect(failureText({ kind: 'rate-limited', retryAfterS: 90 })).toBe(
      'Too many tries. Wait 2 minutes and try again.'
    );
    expect(failureText({ kind: 'rate-limited', retryAfterS: 82_800 })).toBe(
      'Too many tries. Wait 23 hours and try again.'
    );
    expect(failureText({ kind: 'rate-limited', retryAfterS: null })).toMatch(/few minutes/);
    expect(failureText({ kind: 'offline' })).toMatch(/nothing was changed/);
    expect(failureText({ kind: 'not-signed-in' })).toBe(failureText({ kind: 'auth' }));
    expect(say(signInFailureMessage({ kind: 'offline' }))).toMatch(/Signing in needs the internet once/);
  });

  it('a wait in Polish takes the right plural: 1 minuta, 2 minuty, 5 minut (accusative after "Odczekaj")', () => {
    const wait = (s: number) => failureText({ kind: 'rate-limited', retryAfterS: s }, 'pl');
    expect(wait(60)).toBe('Za dużo prób. Odczekaj 1 minutę i spróbuj ponownie.');
    expect(wait(120)).toBe('Za dużo prób. Odczekaj 2 minuty i spróbuj ponownie.');
    expect(wait(300)).toBe('Za dużo prób. Odczekaj 5 minut i spróbuj ponownie.');
    expect(wait(22 * 60)).toBe('Za dużo prób. Odczekaj 22 minuty i spróbuj ponownie.');
    expect(wait(30)).toBe('Za dużo prób. Odczekaj 30 sekund i spróbuj ponownie.');
    expect(wait(5 * 3600)).toBe('Za dużo prób. Odczekaj 5 godzin i spróbuj ponownie.');
  });

  it('a wait is said in seconds under a minute, minutes under an hour, otherwise hours (rounded up)', () => {
    expect(waitFor(0)).toEqual({ unit: 'seconds', count: 1 });
    expect(waitFor(1)).toEqual({ unit: 'seconds', count: 1 });
    expect(waitFor(30)).toEqual({ unit: 'seconds', count: 30 });
    expect(waitFor(59.2)).toEqual({ unit: 'minutes', count: 1 });
    expect(waitFor(60)).toEqual({ unit: 'minutes', count: 1 });
    expect(waitFor(61)).toEqual({ unit: 'minutes', count: 2 });
    expect(waitFor(3540)).toEqual({ unit: 'minutes', count: 59 });
    expect(waitFor(3599)).toEqual({ unit: 'hours', count: 1 });
    expect(waitFor(3600)).toEqual({ unit: 'hours', count: 1 });
    expect(waitFor(3601)).toEqual({ unit: 'hours', count: 2 });
    expect(waitFor(82_800)).toEqual({ unit: 'hours', count: 23 });
    expect(failureText({ kind: 'rate-limited', retryAfterS: 1 })).toBe('Too many tries. Wait 1 second and try again.');
  });

  it('the rows in Polish', () => {
    const r = rowsIn(account, { status: 'offline' }, translator('account', 'pl'), 'pl');
    expect(r.email.value).toBe('Wymaga internetu');
    const ready = rowsIn(
      account,
      {
        status: 'ready',
        settings: {
          kind: 'account',
          email: 'ola@example.com',
          name: 'Ola',
          hasPassword: true,
          passwordChangedAt: Date.UTC(2026, 9, 20, 12),
        },
      },
      translator('account', 'pl'),
      'pl'
    );
    expect(ready.password?.value).toBe('Ustawione · 20 paź 2026');
    expect(ready.signIn).toBe('Kod z e-maila · hasło do konta');
  });
});
