import { translator } from '@/i18n/translator';

import { ACTION_ERROR_KEY, ERROR_KEY } from '../cloud-backup-card.constants';
import {
  describeLastRun,
  describeOffer,
  describeProgress,
  describeRefused,
  describeRestoreProgress,
  describeRestoreResult,
} from '../format';

const NOW = new Date(2026, 9, 20, 14, 30).getTime();
const en = translator('backup', 'en');
const pl = translator('backup', 'pl');
const done = (restored: number, extra: { skipped?: number; healthOffered?: boolean } = {}) =>
  ({ kind: 'done', restored, skipped: 0, backupOn: true, healthOffered: false, ...extra }) as const;

describe('cloud backup copy', () => {
  it('says when the last run was, in words (dates from Intl in the app language)', () => {
    expect(describeLastRun(NOW - 20_000, NOW, en, 'en-GB')).toBe('just now');
    expect(describeLastRun(NOW - 5 * 60_000, NOW, en, 'en-GB')).toBe('5 min ago');
    expect(describeLastRun(new Date(2026, 9, 20, 9, 5).getTime(), NOW, en, 'en-GB')).toBe('today 09:05');
    expect(describeLastRun(new Date(2026, 9, 18, 9, 30).getTime(), NOW, en, 'en-GB')).toBe('18 Oct, 09:30');
    expect(describeLastRun(NOW - 20_000, NOW, pl, 'pl')).toBe('przed chwilą');
    expect(describeLastRun(NOW - 5 * 60_000, NOW, pl, 'pl')).toBe('5 min temu');
    expect(describeLastRun(new Date(2026, 9, 20, 9, 5).getTime(), NOW, pl, 'pl')).toBe('dziś 09:05');
    expect(describeLastRun(new Date(2026, 9, 18, 9, 30).getTime(), NOW, pl, 'pl')).toBe('18 paź, 09:30');
  });

  it('describes progress and refusals', () => {
    expect(describeProgress({ backedUp: 12, total: 40, lastRunAt: null }, NOW, en)).toBe(
      'Backed up 12 of 40 activities'
    );
    expect(describeProgress({ backedUp: 1, total: 1, lastRunAt: NOW - 120_000 }, NOW, en, 'en-GB')).toBe(
      'Backed up 1 of 1 activity · last run 2 min ago'
    );
    expect(describeProgress({ backedUp: 1, total: 1, lastRunAt: NOW - 120_000 }, NOW, pl, 'pl')).toBe(
      'W kopii 1 z 1 aktywności · ostatnio 2 min temu'
    );
    expect(describeRefused(1, en)).toBe('1 activity can’t be backed up (too long or unreadable).');
    expect(describeRefused(2, en)).toBe('2 activities can’t be backed up (too long or unreadable).');
    expect(describeRefused(1, pl)).toBe('Nie da się zapisać w kopii 1 aktywności (jest za długa lub nieczytelna).');
    expect(describeRefused(5, pl)).toBe('Nie da się zapisać w kopii 5 aktywności (są za długie lub nieczytelne).');
  });

  it('has plain words for every error code, in both languages', () => {
    const te = translator('errors', 'en');
    const tp = translator('errors', 'pl');
    for (const key of [...Object.values(ERROR_KEY), ...Object.values(ACTION_ERROR_KEY)]) {
      expect(te(key).length).toBeGreaterThan(10);
      expect(tp(key)).not.toBe(te(key));
    }
    expect(Object.keys(ERROR_KEY).sort()).toEqual(
      [
        'auth',
        'busy',
        'consent',
        'needs-device-token',
        'no-token',
        'not-available',
        'not-ready',
        'offline',
        'outdated',
        'server',
      ].sort()
    );
    expect(te(ERROR_KEY['no-token'])).toBe('Sign in with your email to back up.');
  });
});

describe('restore copy', () => {
  it('offers what the phone lacks, and says when there was nothing to bring', () => {
    expect(describeOffer({ kind: 'available', count: 1 }, en)).toBe(
      'Your backup holds 1 activity that isn’t on this phone. Bring it over and your turf comes back with it. Nothing here is replaced.'
    );
    expect(describeOffer({ kind: 'available', count: 3 }, en)).toMatch(
      /^Your backup holds 3 activities that aren’t on this phone\./
    );
    expect(describeOffer({ kind: 'available', count: 1 }, pl)).toMatch(/^W Twojej kopii jest 1 aktywność, której/);
    expect(describeOffer({ kind: 'available', count: 3 }, pl)).toMatch(/^W Twojej kopii są 3 aktywności, których/);
    expect(describeOffer({ kind: 'available', count: 5 }, pl)).toMatch(/^W Twojej kopii jest 5 aktywności, których/);
    expect(describeRestoreResult(done(0), en)).toBe('This phone already has everything in your backup.');
    expect(describeRestoreResult(done(2), en)).toBe('Restored 2 activities.');
    expect(describeRestoreResult(done(1), pl)).toBe('Przywrócono 1 aktywność.');
    expect(describeRestoreResult(done(22), pl)).toBe('Przywrócono 22 aktywności.');
    expect(describeRestoreResult(done(3, { skipped: 1 }), en)).toBe(
      'Restored 3. 1 couldn’t be read and stayed on the server.'
    );
    expect(describeRestoreProgress({ done: 2, total: 40 }, en)).toBe('Restoring 3 of 40…');
    expect(describeRestoreProgress(null, pl)).toBe('Przywracanie…');
  });

  it('says Apple Health stayed off on this phone, and where to turn it on (iOS only)', () => {
    const r = done(2, { healthOffered: true });
    expect(describeRestoreResult(r, en, { health: true })).toBe(
      'Restored 2 activities. Apple Health workouts aren’t backed up from this phone. You can turn that on in Info › Cloud backup.'
    );
    expect(describeRestoreResult(r, en)).toBe('Restored 2 activities.');
  });

  it('no credentials: a real account signs in, a local profile confirms its email with a code in Info', () => {
    const noToken = { kind: 'unavailable', reason: 'no-token' } as const;
    expect(describeRestoreResult(noToken, en)).toBe('Sign in with your email to restore your backup.');
    expect(describeRestoreResult(noToken, pl)).toBe('Zaloguj się adresem e-mail, aby przywrócić kopię.');
    expect(describeRestoreResult(noToken, en, { localProfile: true })).toBe(
      'To restore, first confirm your email with a code in Info › Cloud backup.'
    );
    expect(describeRestoreResult(noToken, pl, { localProfile: true })).toBe(
      'Aby przywrócić kopię, najpierw potwierdź adres e-mail kodem: Informacje › Kopia w chmurze.'
    );
    expect(describeRestoreResult({ kind: 'unavailable', reason: 'busy' }, en, { localProfile: true })).toBeNull();
  });

  it('a paused restore says why', () => {
    const paused = { kind: 'paused', reason: 'offline', done: 0, total: 0 } as const;
    expect(describeRestoreResult(paused, en)).toBe(
      'No connection right now. Tap Restore when you’re online; it carries on where it stopped.'
    );
    expect(describeRestoreResult(paused, pl)).toMatch(/^Brak połączenia\./);
  });
});
