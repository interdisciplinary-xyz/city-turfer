import type { BackupStatus } from '../contract';
import type { BackupErrorKey, CloudBackupCardMode, CloudBackupCardProps } from './cloud-backup-card.constants';

type ModeStatus = Pick<BackupStatus, 'hasToken' | 'enabled' | 'withdrawalPending'>;

/**
 * The card's parts. With credentials it is the normal card, whatever the profile. Without: a
 * linkable local profile gets the code offer instead of the disabled switch; anything else keeps
 * "Sign in with your email"; while the offer is loading, neither shows. The switch stays while
 * backup is on (to turn it off) or its withdrawal is pending (so the state is visible).
 */
export function cloudBackupCardMode(status: ModeStatus, link: CloudBackupCardProps['link']): CloudBackupCardMode {
  if (status.hasToken) {
    return { offerLink: false, signInFirst: false, showSwitch: true };
  }
  const offerLink = link !== null && link !== 'loading';
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
 * shows (the offer already says it).
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
  return status.lastError;
}
