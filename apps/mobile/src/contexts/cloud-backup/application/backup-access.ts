import { sourceOf } from '../domain/backup-policy';
import type { BackupErrorCode, BackupSettings, ConsentPurpose } from '../domain/backup-settings';
import type { ApiClient, ApiFailure, CloudBackupDeps } from './ports';

/** How a failed request stops a run (or a switch), as an error code the UI explains. */
export function errorOf(f: ApiFailure): BackupErrorCode {
  switch (f.kind) {
    case 'auth':
    case 'consent':
    case 'offline':
    case 'outdated':
      return f.kind;
    case 'unavailable':
      return f.reason;
    default:
      return 'server';
  }
}

export type Connection =
  | { kind: 'connected'; api: ApiClient; settings: BackupSettings; token: string }
  | { kind: 'failed'; error: BackupErrorCode; token?: string }
  /** The same token the server refused before: not sent again. */
  | { kind: 'refused' };

/**
 * An authenticated client for the configured server, with the settings for that server and account
 * (another account than last time resets them: see BackupSettings.useAccount). Profiles without an
 * account (demo) and phones without credentials never send a request.
 */
export async function connect(
  d: Pick<CloudBackupDeps, 'available' | 'credentials' | 'api' | 'defaultServerUrl' | 'repo'>,
  s: BackupSettings,
  refusedToken: string | null = null
): Promise<Connection> {
  if (!d.available) {
    return { kind: 'failed', error: 'not-available' };
  }
  const credentials = await d.credentials.current().catch(() => null);
  if (!credentials) {
    return { kind: 'failed', error: 'no-token' };
  }
  if (credentials.token === refusedToken) {
    return { kind: 'refused' };
  }
  const baseUrl = s.toState().serverUrl ?? d.defaultServerUrl;
  const api = d.api({ baseUrl, token: credentials.token });
  let accountId = credentials.accountId;
  if (accountId == null) {
    const me = await api.me(); // a device token: the server says whose it is
    if (!me.ok) {
      return { kind: 'failed', error: errorOf(me.failure), token: credentials.token };
    }
    accountId = me.value.id;
  }
  const settings = await d.repo.useAccount(`${baseUrl}|${accountId}`);
  return { kind: 'connected', api, settings, token: credentials.token };
}

/** What a delivered withdrawal erased on the server (contract: no tombstones, no feed entries). */
const erasedBy = (purpose: ConsentPurpose) =>
  purpose === 'cloud-sync' ? () => true : (id: string) => sourceOf(id) === 'apple-health';

/**
 * Tells the server about consents withdrawn on the phone. Each one that arrives is marked delivered
 * and the phone forgets the server copies it erased (so turning backup on again uploads them anew);
 * the rest are retried on the next run. Never throws for a failed request.
 */
export async function deliverWithdrawals(
  d: Pick<CloudBackupDeps, 'repo' | 'policyVersion'>,
  api: ApiClient,
  s: BackupSettings
): Promise<BackupErrorCode | null> {
  let error: BackupErrorCode | null = null;
  for (const purpose of s.withdrawalsPending) {
    // Read again: turning backup (or Apple Health) back on meanwhile cancels the withdrawal.
    if (!(await d.repo.settings()).withdrawalsPending.includes(purpose)) {
      continue;
    }
    const r = await api.setConsent(purpose, false, d.policyVersion);
    if (r.ok) {
      await d.repo.forgetServerCopies((x) => x.withdrawalDelivered(purpose), erasedBy(purpose));
    } else {
      error ??= errorOf(r.failure);
    }
  }
  return error;
}
