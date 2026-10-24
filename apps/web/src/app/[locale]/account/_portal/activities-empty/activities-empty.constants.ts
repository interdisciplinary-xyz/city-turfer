import type { ActivityType } from '@/api/schema';

import type { BackupState } from '../backup-status/backup-status.constants';

/** Which empty state the list shows (docs/plans/web-portal-history-2026-10-23.md, "Empty states"). */
export type HistoryEmptyKind = 'never' | 'withdrawn' | 'nothing-yet' | 'filter' | 'unknown';

export type ActivitiesEmptyProps = { kind: HistoryEmptyKind; type: ActivityType | null };

/** The consents as the list reads them: still on their way, failed, or the backup's state. */
export type ConsentsAnswer = { status: 'pending' } | { status: 'error' } | { status: 'success'; backup: BackupState };

/** What an empty list shows: wait for the consents (`waiting`: the loading line), or an empty state. */
export type HistoryEmpty = HistoryEmptyKind | 'waiting';

/**
 * The empty state for a list with nothing in it, chosen only once the consents have answered (else
 * "backup is on, nothing yet" would flash, or stick when they fail): the backup's state first
 * (never on, withdrawn: nothing could be listed under any filter), then "no rides" for a filter,
 * else "nothing yet". Consents failed: "no rides" for a filter (true either way), else a neutral
 * line (`unknown`) next to the consents' error.
 */
export function historyEmpty({
  consents,
  type,
  listed,
}: {
  consents: ConsentsAnswer;
  type: ActivityType | null;
  listed: number;
}): HistoryEmpty | null {
  if (listed > 0) {
    return null;
  }
  if (consents.status === 'pending') {
    return 'waiting';
  }
  if (consents.status === 'error') {
    return type ? 'filter' : 'unknown';
  }
  if (consents.backup.kind === 'never') {
    return 'never';
  }
  if (consents.backup.kind === 'withdrawn') {
    return 'withdrawn';
  }
  return type ? 'filter' : 'nothing-yet';
}

/** The lasting line on the list when backup is on without Apple Health workouts. */
export function healthLeftOut(backup: BackupState | null): boolean {
  return backup?.kind === 'on' && !backup.health.included;
}
