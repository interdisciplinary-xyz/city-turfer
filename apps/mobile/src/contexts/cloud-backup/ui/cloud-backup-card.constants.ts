import type { BackupErrorCode } from '../contract';

export const CLOUD_BACKUP_TITLE = 'Cloud backup';

export const CLOUD_BACKUP_PITCH =
  'Keep a copy of your walks, runs and rides on the CityTurfer server, so a new phone never means starting your turf again.';

export const BACKUP_SWITCH_LABEL = 'Back up to CityTurfer cloud';

export const BACKUP_PRIVACY =
  'Your routes are stored on our server in the EU. Turning this off deletes that copy; nothing on this phone.';

export const OFF_CONFIRM_TITLE = 'Turn off cloud backup?';
export const OFF_CONFIRM_TEXT =
  'The copy of your activities on our server will be deleted. Everything stays on this phone, and you can turn backup on again any time.';

export const HEALTH_SWITCH_LABEL = 'Include Apple Health workouts';

export const HEALTH_NOTE = 'Off: workouts imported from Apple Health stay on this phone (and leave the server).';

export const TOKEN_LABEL = 'Device token';
export const TOKEN_PLACEHOLDER = 'Paste your device token';
export const TOKEN_SAVED = 'Device token saved on this phone.';

export const SERVER_LABEL = 'Server (for testing)';

export const DEV_BACKUP_TITLE = 'Backup: device token and server';
export const DEV_BACKUP_NOTE =
  'For testing. Signing in with your email replaces the device token; another server starts the backup afresh.';

export const ERROR_TITLE = 'Cloud backup';

/** Turned off, but the server could not be told yet. */
export const OFF_PENDING = "Backup is off. We'll let the server know next time you're online.";

/** Why backup stopped, in plain words (no guilt, one next step). */
export const ERROR_TEXT: Record<BackupErrorCode, string> = {
  'no-token': 'Sign in with your email to back up.',
  auth: 'Your sign-in has expired. Sign in again to carry on backing up.',
  consent: 'The server has no backup consent from you yet. Turn backup off and on again.',
  offline: "No connection right now. We'll carry on when you're online.",
  server: "The server had a hiccup. We'll try again shortly.",
  'not-ready': "The backup server isn't ready yet. Your activities wait safely on this phone.",
  busy: "The server is busy. We'll try again in a moment.",
  outdated: 'Update CityTurfer to keep backing up.',
  'not-available': 'The demo account stays on this phone: it is never backed up.',
};

/** Domain error codes of the card's actions, in plain words. */
export const ACTION_ERRORS: Record<string, string> = {
  'backup.invalid-token': "That doesn't look like a device token. Paste it again.",
  'backup.invalid-server-url': 'Use a full address starting with https:// (or http:// on your own network).',
  'backup.on': 'Turn backup off first.',
  'backup.off': 'Turn backup on first.',
};

export const ACTION_FAILED = 'Something went wrong. Try again.';

/** "2 activities can't be backed up (too long or unreadable)." */
export function describeRefused(n: number): string {
  return `${n} ${n === 1 ? "activity can't" : "activities can't"} be backed up (too long or unreadable).`;
}
