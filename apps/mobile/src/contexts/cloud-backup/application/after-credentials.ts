import type { BackupErrorCode, BackupStatus } from '../contract';
import { connect } from './backup-access';
import type { CloudBackupDeps } from './ports';
import type { RunBackup } from './run-backup';
import type { EnableBackup } from './settings-use-cases';

/**
 * What to do once a profile's credentials arrived (a local profile linked by an e-mailed code, LP1):
 * - `enable`: backup was off with nothing pending, so the Turfer came to turn it on;
 * - `resume`: backup is on already (opened by password, LP2, or its session ran out): carry on;
 * - `deliver-withdrawal`: backup was turned off while it had no credentials; tell the server (it
 *   deletes its copy) and leave the switch to the Turfer: never turn it back on from here.
 */
export type AfterCredentialsPlan = 'enable' | 'resume' | 'deliver-withdrawal';

/** The plan for a status (also what the code screen's button says: "Turn on backup" only for `enable`). */
export function afterCredentialsPlan(s: Pick<BackupStatus, 'enabled' | 'withdrawalPending'>): AfterCredentialsPlan {
  if (s.withdrawalPending && !s.enabled) {
    return 'deliver-withdrawal';
  }
  return s.enabled ? 'resume' : 'enable';
}

/**
 * - `turned-on`: the consent is recorded and backup is on; `carried-on`: it was on and stays on.
 *   Either way the caller starts a run (and shows its progress).
 * - `stayed-off`: backup stays off; `delivered`: the server has heard the withdrawal (its copy is
 *   deleted), else it hears it on a later run.
 * - `needs-consent`: backup was on, but the address's account is not the one it was on for (that
 *   one was deleted and the code made a new one): the new account starts afresh, off. Turning it on
 *   records a consent, so it is the Turfer's tap ("Turn on backup"), never implied by "Confirm code".
 * - `failed`: turning backup on failed (why); trying again is safe.
 */
export type AfterCredentialsResult =
  | { kind: 'turned-on' }
  | { kind: 'carried-on' }
  | { kind: 'stayed-off'; delivered: boolean }
  | { kind: 'needs-consent' }
  | { kind: 'failed'; error: BackupErrorCode };

/**
 * After the credentials arrived: decides from the settings read now (after any run in flight) and
 * acts on the consent rule — turn backup on only when it was off with nothing pending; a pending
 * withdrawal is delivered, never overridden.
 */
export class AfterCredentialsArrived {
  constructor(
    private readonly d: CloudBackupDeps,
    private readonly enable: EnableBackup,
    private readonly run: RunBackup
  ) {}

  async execute(): Promise<AfterCredentialsResult> {
    if (!this.d.available) {
      return { kind: 'failed', error: 'not-available' };
    }
    await this.run.whenIdle();
    const s = await this.d.repo.updateSettings((x) => x.credentialsArrived());
    const plan = afterCredentialsPlan({
      enabled: s.enabled,
      withdrawalPending: s.withdrawalsPending.includes('cloud-sync'),
    });
    if (plan === 'deliver-withdrawal') {
      await this.run.execute({ now: true });
      const delivered = !(await this.d.repo.settings()).withdrawalsPending.includes('cloud-sync');
      return { kind: 'stayed-off', delivered };
    }
    if (plan === 'enable') {
      const r = await this.enable.execute();
      return r.kind === 'ok' ? { kind: 'turned-on' } : r;
    }
    // Decided only once connected: another account than last time resets the state (off).
    const c = await connect(this.d, s);
    if (c.kind === 'connected' && !c.settings.enabled) {
      return { kind: 'needs-consent' };
    }
    return { kind: 'carried-on' }; // a failure to connect is the run's to report (the card shows it)
  }
}
