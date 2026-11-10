import type { Consent } from '@/lib/api/schema';

export type BackupStatusProps = { consents: readonly Consent[]; locale: string };

// The pure consent logic lives in the portal domain: the Activities pages use it too, and importing
// it from this domain's barrel would ship the whole Privacy & data page with them.
export { type BackupState, backupState } from '@/domains/portal/logic';
