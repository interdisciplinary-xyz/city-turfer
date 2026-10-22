import type { RestoreOffer, RestoreProgress, RestoreResult } from '../application/restore';

export const RESTORE_TITLE = 'Welcome back';

/** "Your backup holds 42 activities that aren't on this phone. …" */
export function describeOffer(offer: Extract<RestoreOffer, { kind: 'available' | 'resume' }>): string {
  if (offer.kind === 'resume') {
    return `Restoring your backup stopped at ${offer.done} of ${offer.total} activities. Carry on where it left off.`;
  }
  const n = offer.count;
  const them = n === 1 ? 'it' : 'them';
  return `Your backup holds ${n} ${n === 1 ? "activity that isn't" : "activities that aren't"} on this phone. Bring ${them} over and your turf comes back with ${them}. Nothing here is replaced.`;
}

/** The always-available action on the Cloud backup card. */
export const RESTORE_ACTION = 'Restore from backup';
export const RESTORE_ACTION_NOTE =
  "Brings over anything in your backup that isn't on this phone. Nothing here is replaced or doubled.";

/** After a restore that left backup off (its consents couldn't be read from the server). */
export const BACKUP_OFF_AFTER_RESTORE =
  'Cloud backup is off on this phone. Turn it on to keep new activities safe too.';
export const TURN_ON_BACKUP = 'Turn on backup';

export function describeProgress(p: RestoreProgress | null): string {
  return p && p.total > 0 ? `Restoring ${Math.min(p.done + 1, p.total)} of ${p.total}…` : 'Restoring…';
}

/** After a restore, when the account backs up Apple Health workouts but this phone doesn't (yet). */
export const HEALTH_OFF_AFTER_RESTORE =
  "Apple Health workouts aren't backed up from this phone. You can turn that on in Info › Cloud backup.";

/**
 * What the result means, in plain words (null: nothing to say). `health`: Apple Health is possible on
 * this phone (iOS), so mention that it was left off.
 */
export function describeResult(r: RestoreResult | null, { health = false }: { health?: boolean } = {}): string | null {
  if (!r) {
    return null;
  }
  switch (r.kind) {
    case 'done': {
      const what =
        r.skipped > 0
          ? `Restored ${r.restored}. ${r.skipped} couldn't be read and stayed on the server.`
          : r.restored === 0
            ? 'This phone already has everything in your backup.'
            : `Restored ${r.restored} ${r.restored === 1 ? 'activity' : 'activities'}.`;
      return health && r.healthOffered ? `${what} ${HEALTH_OFF_AFTER_RESTORE}` : what;
    }
    case 'paused':
      return {
        recording: 'Finish your recording first. Restoring carries on afterwards.',
        background: 'Restoring paused while CityTurfer was in the background. Tap Restore to carry on.',
        offline: "No connection right now. Tap Restore when you're online; it carries on where it stopped.",
        server: 'The server had a hiccup. Tap Restore to try again.',
        auth: 'Your sign-in has expired. Sign in again to restore.',
      }[r.reason];
    default:
      return r.reason === 'no-token' ? 'Sign in with your email to restore your backup.' : null;
  }
}
