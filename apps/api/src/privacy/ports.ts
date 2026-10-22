/** Privacy ports: export jobs and the file storage their zips live in. */

export type ExportStatus = 'ready' | 'downloaded' | 'expired' | 'failed';

export interface ExportRecord {
  id: string;
  status: ExportStatus;
  requestedAt: number;
  readyAt: number | null;
  expiresAt: number | null;
  downloadedAt: number | null;
  fileKey: string | null;
  byteSize: number | null;
}

export interface ExportStore {
  /** The user's newest export that did not fail, or null. */
  latest(userId: string): Promise<ExportRecord | null>;
  get(userId: string, id: string): Promise<ExportRecord | null>;
  insert(userId: string, record: ExportRecord, keyHash: string | null): Promise<void>;
  /**
   * Claims a download once: marks the export with this key hash downloaded (if it is ready and not
   * expired at `now`) and returns it with its owner; `gone` when it exists but was used or expired.
   */
  claim(keyHash: string, now: number): Promise<{ userId: string; export: ExportRecord } | 'gone' | null>;
}

/** Port: opaque files (Postgres `bytea` now, Vercel Blob later). Owner rows cascade on erasure. */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, meta: { ownerId: string; contentType: string; expiresAt: number }): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Deletes files past their expiry. */
  purgeExpired(now: number): Promise<void>;
}
