import { translator } from '@/i18n/translator';

import type { BackupLinkOffer } from '../cloud-backup-card.constants';
import { cloudBackupCardMode, offPendingNotice, shownLastError } from '../cloud-backup-card-state';

const offer = (email: string): BackupLinkOffer => ({ email, onRequestCode: () => undefined });
const NORMAL = { offerLink: false, signInFirst: false, showSwitch: true };
const st = (hasToken: boolean, enabled: boolean, withdrawalPending = false) => ({
  hasToken,
  enabled,
  withdrawalPending,
});

describe('Cloud backup card: which parts show', () => {
  it('a local profile without credentials: the code offer instead of the disabled switch', () => {
    expect(cloudBackupCardMode(st(false, false), offer('admin@cityturfer.com'))).toEqual({
      offerLink: true,
      signInFirst: false,
      showSwitch: false,
    });
  });

  it('the demo profile is offered the code like admin (its history backs up too, LP3)', () => {
    expect(cloudBackupCardMode(st(false, false), offer('demo@cityturfer.com')).offerLink).toBe(true);
  });

  it('linked with credentials: the normal card, as for a real account', () => {
    expect(cloudBackupCardMode(st(true, false), offer('admin@cityturfer.com'))).toEqual(NORMAL);
    expect(cloudBackupCardMode(st(true, true), offer('demo@cityturfer.com'))).toEqual(NORMAL);
  });

  it('after a password sign-in (LP2) backup still on: the offer, and the switch to turn it off', () => {
    expect(cloudBackupCardMode(st(false, true), offer('admin@cityturfer.com'))).toEqual({
      offerLink: true,
      signInFirst: false,
      showSwitch: true,
    });
  });

  it('turned off without credentials (withdrawal pending): the switch stays in view, with the offer', () => {
    expect(cloudBackupCardMode(st(false, false, true), offer('admin@cityturfer.com'))).toEqual({
      offerLink: true,
      signInFirst: false,
      showSwitch: true,
    });
  });

  it('a local profile whose session was revoked or expired (auth): the code offer again, with the switch', () => {
    const revoked = { ...st(true, true), lastError: 'auth' as const };
    const mode = cloudBackupCardMode(revoked, offer('admin@cityturfer.com'));
    expect(mode).toEqual({ offerLink: true, signInFirst: false, showSwitch: true });
    expect(cloudBackupCardMode(revoked, offer('demo@cityturfer.com')).offerLink).toBe(true);
    // The offer says it: no "sign in again" (a password would only open the phone's data, LP2).
    expect(shownLastError(revoked, mode)).toBeNull();
    // Turned off meanwhile with the withdrawal pending: it needs the code too.
    const off = { ...st(true, false, true), lastError: 'auth' as const };
    expect(offPendingNotice(off, cloudBackupCardMode(off, offer('admin@cityturfer.com')))).toBe('backupOffNeedsCode');
  });

  it('a refused session on a real account (or while the offer loads) keeps "sign in again"', () => {
    const revoked = { ...st(true, true), lastError: 'auth' as const };
    expect(cloudBackupCardMode(revoked, null)).toEqual(NORMAL);
    expect(shownLastError(revoked, cloudBackupCardMode(revoked, null))).toBe('auth');
    expect(cloudBackupCardMode(revoked, 'loading')).toEqual(NORMAL);
    // Other errors on a linked local profile: the normal card.
    expect(cloudBackupCardMode({ ...st(true, true), lastError: 'offline' }, offer('admin@cityturfer.com'))).toEqual(
      NORMAL
    );
  });

  it('a real account is unchanged: with credentials the normal card, without them "Sign in with your email"', () => {
    expect(cloudBackupCardMode(st(true, true), null)).toEqual(NORMAL);
    expect(cloudBackupCardMode(st(false, false), null)).toEqual({
      offerLink: false,
      signInFirst: true,
      showSwitch: true,
    });
  });

  it('while the offer is loading, nothing flashes: no offer, no "Sign in with your email", no disabled switch', () => {
    expect(cloudBackupCardMode(st(false, false), 'loading')).toEqual({
      offerLink: false,
      signInFirst: false,
      showSwitch: false,
    });
    // On (it can be turned off) or a withdrawal pending: the switch shows as it is.
    expect(cloudBackupCardMode(st(false, true), 'loading').showSwitch).toBe(true);
    expect(cloudBackupCardMode(st(false, false, true), 'loading').showSwitch).toBe(true);
  });
});

describe('Cloud backup card: backup off while the server still has the copy', () => {
  it('a linkable local profile without credentials needs a code, not "next time you’re online"', () => {
    const s = st(false, false, true);
    expect(offPendingNotice(s, cloudBackupCardMode(s, offer('admin@cityturfer.com')))).toBe('backupOffNeedsCode');
    expect(translator('errors', 'en')('backupOffNeedsCode')).toBe(
      'Backup is off, but the server still has your copy. To have it deleted, confirm your email with a code.'
    );
    expect(translator('errors', 'pl')('backupOffNeedsCode')).toContain('kodem');
  });

  it('with credentials (offline) or a real account: "next time you’re online"', () => {
    const linked = st(true, false, true);
    expect(offPendingNotice(linked, cloudBackupCardMode(linked, offer('admin@cityturfer.com')))).toBe(
      'backupOffPending'
    );
    const real = st(false, false, true);
    expect(offPendingNotice(real, cloudBackupCardMode(real, null))).toBe('backupOffPending');
  });

  it('nothing pending, or backup on: no note', () => {
    for (const s of [st(false, false), st(true, true), st(false, true)]) {
      expect(offPendingNotice(s, cloudBackupCardMode(s, offer('admin@cityturfer.com')))).toBeNull();
    }
  });
});

describe('copy', () => {
  it('the offer names the fixed address in both languages', () => {
    expect(translator('backup', 'en')('link.offer', { email: 'admin@cityturfer.com' })).toBe(
      'Backing up this profile needs a code, which we’ll email to admin@cityturfer.com.'
    );
    expect(translator('backup', 'pl')('link.offer', { email: 'admin@cityturfer.com' })).toContain(
      'admin@cityturfer.com'
    );
    expect(translator('backup', 'en')('link.resendIn', { count: 1 })).toBe('Send a new code in 1 second');
    expect(translator('backup', 'pl')('link.resendIn', { count: 5 })).toBe('Wyślij nowy kod za 5 sekund');
  });
});

describe('Cloud backup card: the last run’s error', () => {
  const withError = (hasToken: boolean, enabled: boolean, lastError: 'no-token' | 'offline' | null) => ({
    ...st(hasToken, enabled),
    lastError,
  });
  const linkable = offer('admin@cityturfer.com');

  it('relinked with backup on (LP2, then a code): a stale "no-token" from the run before is hidden', () => {
    const s = withError(true, true, 'no-token');
    expect(shownLastError(s, cloudBackupCardMode(s, linkable))).toBeNull();
    expect(shownLastError(s, cloudBackupCardMode(s, null))).toBeNull(); // real account signed in again
  });

  it('while the offer shows, "no-token" is said by the offer, not as an error', () => {
    const s = withError(false, true, 'no-token');
    expect(shownLastError(s, cloudBackupCardMode(s, linkable))).toBeNull();
  });

  it('a real account without credentials still sees "no-token"; other errors always show while on', () => {
    const s = withError(false, true, 'no-token');
    expect(shownLastError(s, cloudBackupCardMode(s, null))).toBe('no-token');
    const offline = withError(true, true, 'offline');
    expect(shownLastError(offline, cloudBackupCardMode(offline, linkable))).toBe('offline');
  });

  it('backup off: no run error', () => {
    const s = withError(true, false, 'offline');
    expect(shownLastError(s, cloudBackupCardMode(s, null))).toBeNull();
  });
});
