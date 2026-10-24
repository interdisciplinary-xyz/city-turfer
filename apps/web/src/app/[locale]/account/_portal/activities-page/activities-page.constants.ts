import type { Locale } from '@/i18n/routing';

import type { ConsentsAnswer } from '../activities-empty/activities-empty.constants';
import type { BackupState } from '../backup-status/backup-status.constants';

export type ActivitiesPageProps = { locale: Locale };

/**
 * Whether the list and totals may show what memory holds. Not when the consents say backup was
 * never on or is withdrawn: what is cached is from before, and the page says why it is empty.
 * While the consents are on their way, or failed, the list shows as the API answered.
 */
export function historyShown(consents: ConsentsAnswer): boolean {
  return !(consents.status === 'success' && (consents.backup.kind === 'never' || consents.backup.kind === 'withdrawn'));
}

/** The backup's state as one comparable value (null until the consents answered). */
export function backupKey(backup: BackupState | null): string | null {
  if (!backup) {
    return null;
  }
  switch (backup.kind) {
    case 'never':
      return 'never';
    case 'withdrawn':
      return `withdrawn@${backup.at}`;
    case 'on':
      return `on@${backup.since}|health:${backup.health.included ? backup.health.since : 'off'}`;
  }
}

/** The consents' answer changed since the last one this page saw: re-read the list and totals. */
export function backupChanged(previous: string | null, next: string | null): boolean {
  return previous !== null && next !== null && previous !== next;
}
