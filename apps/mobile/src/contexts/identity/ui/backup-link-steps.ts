import type { LinkSignedInProfileResult, RequestBackupLinkCodeResult } from '@/contexts/identity';

import { INVALID_CODE } from './account-settings.constants';
import type { BackupLinkOutcome } from './backup-link-flow.constants';

/** What both requests answer alike: no connection, a wait, nothing to link here, the server. */
function common(
  r: Exclude<RequestBackupLinkCodeResult | LinkSignedInProfileResult, { kind: 'sent' | 'linked' }>
): BackupLinkOutcome {
  switch (r.kind) {
    case 'rate-limited':
      return { kind: 'refused', failure: r }; // worded with its wait, which also holds the send buttons
    case 'offline':
      return { kind: 'error', error: { key: 'backupLink.offline' } };
    case 'not-local-profile':
      return { kind: 'error', error: { key: 'backupLink.notLocalProfile' } };
    case 'accounts-unavailable':
      return { kind: 'error', error: { key: 'accountsUnavailable' } };
    default:
      return { kind: 'error', error: { key: 'server' } };
  }
}

/** "Email me a code": sent to the profile's own address → its code field (cleared). */
export function afterBackupLinkCode(r: RequestBackupLinkCodeResult): BackupLinkOutcome {
  switch (r.kind) {
    case 'sent':
      return { kind: 'go', step: 'code', sentTo: r.email, clear: 'code' };
    case 'invalid-email':
      return { kind: 'error', error: { key: 'invalidEmail' } };
    default:
      return common(r);
  }
}

/** The code from `email`'s inbox: linked → turn backup on; anything else stays with its message. */
export function afterBackupLink(r: LinkSignedInProfileResult, email: string): BackupLinkOutcome {
  switch (r.kind) {
    case 'linked':
      return { kind: 'go', step: 'turning-on' };
    case 'invalid-code':
      return { kind: 'error', error: INVALID_CODE };
    case 'not-signed-in':
      return { kind: 'error', error: { key: 'backupLink.notSignedIn' } };
    case 'email-mismatch':
      return { kind: 'error', error: { key: 'backupLink.emailMismatch', values: { email } } };
    case 'profile-taken':
      return { kind: 'error', error: { key: 'backupLink.profileTaken' } };
    case 'linked-elsewhere':
      return { kind: 'error', error: { key: 'backupLink.linkedElsewhere', values: { email } } };
    default:
      return common(r);
  }
}
