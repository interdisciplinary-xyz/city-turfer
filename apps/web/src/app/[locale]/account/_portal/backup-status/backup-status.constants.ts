import type { Consent } from '@/api/schema';

export type BackupStatusProps = { consents: readonly Consent[]; locale: string };

/** Where the user's backup stands, from the latest consent decisions (GET /v1/me/consents). */
export type BackupState =
  | { kind: 'never' }
  | { kind: 'withdrawn'; at: string }
  | {
      kind: 'on';
      since: string;
      policyVersion: string;
      health: { included: true; since: string } | { included: false };
    };

export function backupState(consents: readonly Consent[]): BackupState {
  const cloud = consents.find((consent) => consent.purpose === 'cloud-sync');
  if (!cloud) {
    return { kind: 'never' };
  }
  if (!cloud.granted) {
    return { kind: 'withdrawn', at: cloud.at };
  }
  const health = consents.find((consent) => consent.purpose === 'apple-health-in-cloud-sync');
  return {
    kind: 'on',
    since: cloud.at,
    policyVersion: cloud.policyVersion,
    health: health?.granted ? { included: true, since: health.at } : { included: false },
  };
}
