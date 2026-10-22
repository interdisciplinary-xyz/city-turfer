import { describeRefused, ERROR_TEXT } from '../cloud-backup-card.constants';
import { describeLastRun, describeProgress } from '../format';
import { describeOffer, describeResult } from '../restore-card.constants';

const NOW = new Date(2026, 9, 20, 14, 30).getTime();

describe('cloud backup copy', () => {
  it('says when the last run was, in words', () => {
    expect(describeLastRun(NOW - 20_000, NOW)).toBe('just now');
    expect(describeLastRun(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(describeLastRun(new Date(2026, 9, 20, 9, 5).getTime(), NOW)).toBe('today 09:05');
    expect(describeLastRun(new Date(2026, 9, 18, 9, 30).getTime(), NOW)).toBe('18 Oct, 09:30');
  });

  it('describes progress and refusals', () => {
    expect(describeProgress({ backedUp: 12, total: 40, lastRunAt: null }, NOW)).toBe('Backed up 12 of 40 activities');
    expect(describeProgress({ backedUp: 1, total: 1, lastRunAt: NOW - 120_000 }, NOW)).toBe(
      'Backed up 1 of 1 activity · last run 2 min ago'
    );
    expect(describeRefused(1)).toBe("1 activity can't be backed up (too long or unreadable).");
    expect(describeRefused(2)).toBe("2 activities can't be backed up (too long or unreadable).");
  });

  it('has plain words for every error code', () => {
    for (const text of Object.values(ERROR_TEXT)) {
      expect(text.length).toBeGreaterThan(10);
    }
    expect(Object.keys(ERROR_TEXT).sort()).toEqual(
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
  });
});

describe('restore copy', () => {
  it('offers what the phone lacks, and says when there was nothing to bring', () => {
    expect(describeOffer({ kind: 'available', count: 1 })).toBe(
      "Your backup holds 1 activity that isn't on this phone. Bring it over and your turf comes back with it. Nothing here is replaced."
    );
    expect(describeOffer({ kind: 'available', count: 3 })).toMatch(
      /^Your backup holds 3 activities that aren't on this phone\./
    );
    expect(describeResult({ kind: 'done', restored: 0, skipped: 0, backupOn: true, healthOffered: false })).toBe(
      'This phone already has everything in your backup.'
    );
    expect(describeResult({ kind: 'done', restored: 2, skipped: 0, backupOn: false, healthOffered: false })).toBe(
      'Restored 2 activities.'
    );
  });

  it('says Apple Health stayed off on this phone, and where to turn it on (iOS only)', () => {
    const r = { kind: 'done', restored: 2, skipped: 0, backupOn: true, healthOffered: true } as const;
    expect(describeResult(r, { health: true })).toBe(
      "Restored 2 activities. Apple Health workouts aren't backed up from this phone. You can turn that on in Info › Cloud backup."
    );
    expect(describeResult(r)).toBe('Restored 2 activities.');
  });
});
