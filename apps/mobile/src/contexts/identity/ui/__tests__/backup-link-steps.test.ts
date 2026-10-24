import { translator } from '@/i18n/translator';

import { failureMessage } from '../account-messages';
import { INVALID_CODE } from '../account-settings.constants';
import { afterBackupLink, afterBackupLinkCode } from '../backup-link-steps';

const EMAIL = 'admin@cityturfer.com';

/** The words an outcome shows (a refusal through the same wording as the flow's `refused`). */
function words(o: ReturnType<typeof afterBackupLink>, locale: 'en' | 'pl' = 'en'): string | null {
  const te = translator('errors', locale);
  if (o.kind === 'go') {
    return o.error ? te(o.error.key, o.error.values) : null;
  }
  const m = o.kind === 'error' ? o.error : failureMessage(o.failure);
  return te(m.key, m.values);
}

describe('backup link: "Email me a code"', () => {
  it('sent → the code field, cleared, for the profile’s own address', () => {
    expect(afterBackupLinkCode({ kind: 'sent', email: EMAIL })).toEqual({
      kind: 'go',
      step: 'code',
      sentTo: EMAIL,
      clear: 'code',
    });
  });

  it('a rate limit is a refusal (it holds the send buttons for its wait) worded with that wait', () => {
    const o = afterBackupLinkCode({ kind: 'rate-limited', retryAfterS: 42 });
    expect(o).toEqual({ kind: 'refused', failure: { kind: 'rate-limited', retryAfterS: 42 } });
    expect(words(o)).toBe('Too many tries. Wait 42 seconds and try again.');
    expect(words(o, 'pl')).toBe('Za dużo prób. Odczekaj 42 sekundy i spróbuj ponownie.');
  });

  it('every other answer stays on the step with its own message', () => {
    expect(words(afterBackupLinkCode({ kind: 'offline' }))).toBe(
      'No connection. Turning on backup needs the internet; nothing was changed.'
    );
    expect(words(afterBackupLinkCode({ kind: 'invalid-email' }))).toBe('That doesn’t look like an email address.');
    expect(words(afterBackupLinkCode({ kind: 'not-local-profile' }))).toBe(
      'This profile can’t be backed up with a code. Sign in with your email to back up.'
    );
    expect(words(afterBackupLinkCode({ kind: 'accounts-unavailable' }))).toBe(
      'Signing in to an account is not available in this build.'
    );
    for (const kind of ['unavailable', 'auth'] as const) {
      expect(afterBackupLinkCode({ kind })).toEqual({ kind: 'error', error: { key: 'server' } });
    }
  });
});

describe('backup link: the code', () => {
  it('linked → turning backup on', () => {
    expect(afterBackupLink({ kind: 'linked', user: {} as never }, EMAIL)).toEqual({ kind: 'go', step: 'turning-on' });
  });

  it('a wrong code keeps the field, with the shared message', () => {
    expect(afterBackupLink({ kind: 'invalid-code' }, EMAIL)).toEqual({ kind: 'error', error: INVALID_CODE });
  });

  it('each refusal has its own words, in English and Polish', () => {
    const cases = [
      [{ kind: 'not-signed-in' }, 'This profile isn’t open on this phone any more. Go back to Info and try again.'],
      [{ kind: 'email-mismatch' }, `That code is for another address. Use the latest code we sent to ${EMAIL}.`],
      [
        { kind: 'profile-taken' },
        'This profile’s history now belongs to another CityTurfer account. Sign in with that account’s email to back it up.',
      ],
      [
        { kind: 'linked-elsewhere' },
        `The account for ${EMAIL} already keeps its history in another profile on this phone.`,
      ],
      [
        { kind: 'not-local-profile' },
        'This profile can’t be backed up with a code. Sign in with your email to back up.',
      ],
      [{ kind: 'accounts-unavailable' }, 'Signing in to an account is not available in this build.'],
      [{ kind: 'offline' }, 'No connection. Turning on backup needs the internet; nothing was changed.'],
      [{ kind: 'auth' }, 'Our server had a hiccup. Try again in a moment.'],
      [{ kind: 'unavailable' }, 'Our server had a hiccup. Try again in a moment.'],
      [{ kind: 'rate-limited', retryAfterS: null }, 'Too many tries. Wait a few minutes and try again.'],
    ] as const;
    for (const [r, en] of cases) {
      const o = afterBackupLink(r, EMAIL);
      expect(words(o)).toBe(en);
      const pl = words(o, 'pl');
      expect(pl).toBeTruthy();
      expect(pl).not.toBe(en);
    }
    expect(words(afterBackupLink({ kind: 'email-mismatch' }, EMAIL), 'pl')).toContain(EMAIL);
  });
});
