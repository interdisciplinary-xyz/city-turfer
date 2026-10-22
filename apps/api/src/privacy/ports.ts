/** Privacy ports: export jobs and the file storage their zips live in. */

/** `downloaded` = ready and fetched at least once; it still works until `expiresAt`. */
export type ExportStatus = 'pending' | 'ready' | 'downloaded' | 'expired' | 'failed';

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
  /**
   * Reserves an export under the user's row lock (no two requests race the 24 h rule): `reserved`
   * after inserting `pending`, else the newest export still counting against the window.
   */
  reserve(
    userId: string,
    record: ExportRecord,
    windowMs: number
  ): Promise<{ reserved: true } | { reserved: false; last: ExportRecord }>;
  /** The pending export is ready: its file, size, expiry and the SHA-256 of its link key. */
  complete(
    userId: string,
    id: string,
    done: { readyAt: number; expiresAt: number; fileKey: string; byteSize: number; keyHash: string }
  ): Promise<void>;
  /** Nothing was delivered: `failed` (does not count against the 24 h window). */
  fail(userId: string, id: string): Promise<void>;
  get(userId: string, id: string): Promise<ExportRecord | null>;
  /** The export whose link key has this hash, with its owner. */
  byKeyHash(keyHash: string): Promise<{ userId: string; export: ExportRecord } | null>;
  /** Records the first download (later ones keep the first time). */
  markDownloaded(userId: string, id: string, at: number): Promise<void>;
}

/** Port: opaque files (Postgres `bytea` now, Vercel Blob later). Owner rows cascade on erasure. */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, meta: { ownerId: string; contentType: string; expiresAt: number }): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Deletes files past their expiry. */
  purgeExpired(now: number): Promise<void>;
}
