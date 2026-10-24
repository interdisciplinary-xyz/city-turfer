import type { FlowOutcome } from './account-settings.constants';

/**
 * Backing up a local profile: the code is on its way (or failed to go), the code from the
 * profile's own inbox, then backup is turned on.
 */
export type BackupLinkStep = 'request' | 'code' | 'turning-on';

export type BackupLinkOutcome = FlowOutcome<BackupLinkStep>;

/**
 * What the screen did once the profile was linked: left (backup is on, or carries on), stayed
 * (backup stays off: the Turfer had turned it off; the flow says so and offers Done), or failed to
 * turn backup on (its message; the Turfer can try again with "Turn on backup").
 * `stayed-off`: `delivered` the server has already deleted its copy (else it does once this phone
 * reaches it); `message` says which, worded by the screen (`backup.link.stayedOff` /
 * `backup.link.stayedOffPending`).
 */
export type LinkedOutcome =
  { kind: 'left' } | { kind: 'stayed-off'; delivered: boolean; message: string } | { kind: 'failed'; message: string };

export type BackupLinkFlowProps = {
  /** The profile is linked (its account signed in): the screen decides about backup. */
  onLinked: () => Promise<LinkedOutcome>;
  /** "Done" after `stayed-off`. */
  onDone: () => void;
  /** The code will turn backup on (it is off with nothing pending); false: "Confirm code". */
  turnsOn: boolean;
};
