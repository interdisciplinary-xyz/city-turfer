import type { RestoreOffer, RestoreProgress, RestoreResult } from '../application/restore';

export const RESTORE_TITLE = 'Welcome back';

/** "Your backup holds 42 activities. …" */
export function describeOffer(offer: Extract<RestoreOffer, { kind: 'available' | 'resume' }>): string {
  if (offer.kind === 'resume') {
    return `Restoring your backup stopped at ${offer.done} of ${offer.total} activities. Carry on where it left off.`;
  }
  const n = offer.count;
  return `Your backup holds ${n} ${n === 1 ? 'activity' : 'activities'}. Bring ${n === 1 ? 'it' : 'them'} onto this phone and your turf comes back with ${n === 1 ? 'it' : 'them'}.`;
}

export function describeProgress(p: RestoreProgress | null): string {
  return p && p.total > 0 ? `Restoring ${Math.min(p.done + 1, p.total)} of ${p.total}…` : 'Restoring…';
}

/** What the result means, in plain words (null: nothing to say). */
export function describeResult(r: RestoreResult | null): string | null {
  if (!r) {
    return null;
  }
  switch (r.kind) {
    case 'done':
      return r.skipped > 0
        ? `Restored ${r.restored}. ${r.skipped} couldn't be read and stayed on the server.`
        : `Restored ${r.restored} ${r.restored === 1 ? 'activity' : 'activities'}.`;
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
