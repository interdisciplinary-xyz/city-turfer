import type { BackupErrorCode, BackupSettings } from '../domain/backup-settings';
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

/** An authenticated client for the configured server, or null without a device token. */
export async function openClient(
  d: Pick<CloudBackupDeps, 'tokens' | 'api' | 'defaultServerUrl'>,
  s: BackupSettings
): Promise<ApiClient | null> {
  const token = await d.tokens.read().catch(() => null);
  if (!token) {
    return null;
  }
  return d.api({ baseUrl: s.toState().serverUrl ?? d.defaultServerUrl, token });
}

/**
 * Tells the server about consents withdrawn on the phone. Each one that arrives is marked
 * delivered; the rest are retried on the next run. Never throws for a failed request.
 */
export async function deliverWithdrawals(
  d: Pick<CloudBackupDeps, 'repo' | 'policyVersion'>,
  api: ApiClient,
  s: BackupSettings
): Promise<BackupErrorCode | null> {
  let error: BackupErrorCode | null = null;
  for (const purpose of s.withdrawalsPending) {
    const r = await api.setConsent(purpose, false, d.policyVersion);
    if (r.ok) {
      await d.repo.updateSettings((x) => x.withdrawalDelivered(purpose));
    } else {
      error ??= errorOf(r.failure);
    }
  }
  return error;
}
