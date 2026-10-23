import type { T } from '@/i18n';

import type { BackupErrorCode } from '../contract';

/** A message in the `errors` namespace (the card words it on render, so it follows a language change). */
export type BackupErrorKey = Parameters<T<'errors'>>[0];

/** Why backup stopped, by code: `errors.backup.<code>`. */
export const ERROR_KEY: Record<BackupErrorCode, BackupErrorKey> = {
  'no-token': 'backup.no-token',
  auth: 'backup.auth',
  consent: 'backup.consent',
  offline: 'backup.offline',
  server: 'backup.server',
  'not-ready': 'backup.not-ready',
  busy: 'backup.busy',
  outdated: 'backup.outdated',
  'not-available': 'backup.not-available',
  'needs-device-token': 'backup.needs-device-token',
};

/** Domain error codes of the card's actions: `errors.backupAction.<code>`; anything else is `errors.generic`. */
export const ACTION_ERROR_KEY: Record<string, BackupErrorKey> = {
  'backup.invalid-token': 'backupAction.invalid-token',
  'backup.invalid-server-url': 'backupAction.invalid-server-url',
  'backup.on': 'backupAction.on',
  'backup.off': 'backupAction.off',
  'backup.withdrawal-pending': 'backupAction.withdrawal-pending',
};

// --- Developer tools only (backup-developer-card.tsx): founder-facing, stays English ----------

export const TOKEN_LABEL = 'Device token';
export const TOKEN_PLACEHOLDER = 'Paste your device token';
export const TOKEN_SAVED = 'Device token saved on this phone.';

export const SERVER_LABEL = 'Server (for testing)';

export const DEV_BACKUP_TITLE = 'Backup: device token and server';
export const DEV_BACKUP_NOTE =
  'For testing. Signing in with your email replaces the device token; another server starts the backup afresh.';

export const ERROR_TITLE = 'Cloud backup';

/** Domain error codes of the developer card's actions, in plain words. */
export const ACTION_ERRORS: Record<string, string> = {
  'backup.invalid-token': "That doesn't look like a device token. Paste it again.",
  'backup.invalid-server-url': 'Use a full address starting with https:// (or http:// on your own network).',
  'backup.on': 'Turn backup off first.',
  'backup.off': 'Turn backup on first.',
  'backup.withdrawal-pending': "The server hasn't deleted your backup copy yet. Try again once you're online.",
};

export const ACTION_FAILED = 'Something went wrong. Try again.';
