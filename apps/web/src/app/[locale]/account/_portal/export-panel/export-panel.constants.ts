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
