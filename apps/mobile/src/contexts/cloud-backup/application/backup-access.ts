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
 * (another account than last time resets them: see BackupSettings.useAccount; consent withdrawals
 * still pending for the previous one are delivered to it first). Profiles without an
 * account (demo) and phones without credentials never send a request.
 */
export async function connect(
  d: Pick<
    CloudBackupDeps,
    'available' | 'credentials' | 'api' | 'defaultServerUrl' | 'repo' | 'tokens' | 'policyVersion'
  >,
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
  const key = `${baseUrl}|${accountId}`;
  const stored = await d.repo.settings();
  const previous = stored.toState().accountKey;
  if (previous != null && previous !== key && stored.withdrawalsPending.length > 0) {
    // Switching would reset the state and with it the withdrawals the previous account has not heard
    // about yet: tell that account first (its server copy must go), and only then switch.
    const error = await deliverToPrevious(d, stored, previous, credentials);
    if (error) {
      return { kind: 'failed', error };
    }
  }
  const settings = await d.repo.useAccount(key);
  return { kind: 'connected', api, settings, token: credentials.token };
}

/**
 * Delivers the pending withdrawals to the account the state is about (`previous`, `<server>|<id>`)
 * with a token this phone still has for it: the Developer tools device token, or the signed-in
 * account's bearer. A token counts only when that server names the same account. Returns null once
 * every withdrawal arrived, else why not (no token for that account any more: `auth`).
 */
async function deliverToPrevious(
  d: Pick<CloudBackupDeps, 'tokens' | 'api' | 'repo' | 'policyVersion'>,
  s: BackupSettings,
  previous: string,
  current: { token: string; accountId: string | null }
): Promise<BackupErrorCode | null> {
  const cut = previous.lastIndexOf('|');
  const baseUrl = previous.slice(0, cut);
  const accountId = previous.slice(cut + 1);
  const device = await d.tokens.read().catch(() => null);
  const tokens = [...new Set([device, current.token].filter((t): t is string => t != null))];
  let error: BackupErrorCode = 'auth';
  for (const token of tokens) {
    const api = d.api({ baseUrl, token });
    const me = await api.me();
    if (!me.ok) {
      error = me.failure.kind === 'auth' ? error : errorOf(me.failure);
      continue;
    }
    if (me.value.id !== accountId) {
      continue;
    }
    return deliverWithdrawals(d, api, s);
  }
  return error;
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
