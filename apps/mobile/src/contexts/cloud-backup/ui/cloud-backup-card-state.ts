import type { BackupStatus } from '../contract';
import type { BackupErrorKey, CloudBackupCardMode, CloudBackupCardProps } from './cloud-backup-card.constants';

type ModeStatus = Pick<BackupStatus, 'hasToken' | 'enabled' | 'withdrawalPending'>;

const linkable = (link: CloudBackupCardProps['link']): boolean => link !== null && link !== 'loading';

/**
 * The card's parts. With credentials it is the normal card, whatever the profile. Without: a
 * linkable local profile gets the code offer instead of the disabled switch; anything else keeps
 * "Sign in with your email"; while the offer is loading, neither shows. The switch stays while
 * backup is on (to turn it off) or its withdrawal is pending (so the state is visible).
 * A linkable local profile whose credentials the server refused (`lastError: 'auth'`: the session
 * was revoked from the web or expired) gets the offer again, with the switch: "sign in again" with
 * its password would only open the phone's data (LP2), never reach the server.
 */
export function cloudBackupCardMode(
  status: ModeStatus & Partial<Pick<BackupStatus, 'lastError'>>,
  link: CloudBackupCardProps['link']
): CloudBackupCardMode {
  if (status.hasToken) {
    const refused = status.lastError === 'auth' && linkable(link);
    return { offerLink: refused, signInFirst: false, showSwitch: true };
  }
  const offerLink = linkable(link);
  const signInFirst = link === null;
  return { offerLink, signInFirst, showSwitch: signInFirst || status.enabled || status.withdrawalPending };
}

/**
 * The note about backup being off while the server still holds the copy. Without credentials a
 * linkable local profile can only tell the server after a code, so it says that rather than "next
 * time you're online". Null: nothing pending (or backup is on).
 */
export function offPendingNotice(status: ModeStatus, mode: CloudBackupCardMode): BackupErrorKey | null {
  if (status.enabled || !status.withdrawalPending) {
    return null;
  }
  return mode.offerLink ? 'backupOffNeedsCode' : 'backupOffPending';
}

/**
 * The last run's error, if it still says something true. Only while backup is on. `no-token` is
 * hidden once credentials are back (it was the run before a code or sign-in; the next run clears
 * it, and that run may not have started yet when the card refreshes) and while the code offer
 * shows (the offer already says it); `auth` too while the offer shows (its "sign in again" can't
 * work on a local profile: the offer is the way back).
 */
export function shownLastError(
  status: ModeStatus & Pick<BackupStatus, 'lastError'>,
  mode: CloudBackupCardMode
): BackupStatus['lastError'] {
  if (!status.enabled || !status.lastError) {
    return null;
  }
  if (status.lastError === 'no-token' && (status.hasToken || mode.offerLink)) {
    return null;
  }
  if (status.lastError === 'auth' && mode.offerLink) {
    return null;
  }
  return status.lastError;
}
