import { describeRefused, ERROR_TEXT } from '../cloud-backup-card.constants';
import { describeLastRun, describeProgress } from '../format';

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
      ['auth', 'busy', 'consent', 'no-token', 'not-available', 'not-ready', 'offline', 'outdated', 'server'].sort()
    );
  });
});
