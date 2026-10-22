import type { PortalError } from '@/api/errors';
import type { DataExportJob } from '@/api/schema';

export type ExportPanelProps = {
  /** Where the link goes; null for an account without an e-mail. */
  email: string | null;
  locale: string;
  /** The export this page asked for (kept in memory only), or null before asking. */
  job: DataExportJob | null;
  onRequest: () => void;
  pending: boolean;
  error: PortalError | null;
};

/** The request button shows before asking, and after a `failed` or `expired` export (they don't count). */
export function canRequestExport(job: DataExportJob | null): boolean {
  return job === null || job.status === 'failed' || job.status === 'expired';
}
