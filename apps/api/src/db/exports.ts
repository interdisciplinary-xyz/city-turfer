import { and, desc, eq, isNull, lt, ne, sql } from 'drizzle-orm';

import type { ExportRecord, ExportStatus, ExportStore, FileStorage } from '../privacy/ports';
import { dataExports, storedFiles } from './schema';
import type { Db } from './store';

type Row = typeof dataExports.$inferSelect;

const toRecord = (r: Row): ExportRecord => ({
  id: r.id,
  status: r.status as ExportStatus,
  requestedAt: r.requestedAt.getTime(),
  readyAt: r.readyAt?.getTime() ?? null,
  expiresAt: r.expiresAt?.getTime() ?? null,
  downloadedAt: r.downloadedAt?.getTime() ?? null,
  fileKey: r.fileKey,
  byteSize: r.byteSize,
});

const date = (ms: number | null) => (ms === null ? null : new Date(ms));

export class DrizzleExportStore implements ExportStore {
  constructor(private readonly db: Db) {}

  async latest(userId: string): Promise<ExportRecord | null> {
    const [row] = await this.db
      .select()
      .from(dataExports)
      .where(and(eq(dataExports.userId, userId), ne(dataExports.status, 'failed')))
      .orderBy(desc(dataExports.requestedAt))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async get(userId: string, id: string): Promise<ExportRecord | null> {
    const [row] = await this.db
      .select()
      .from(dataExports)
      .where(and(eq(dataExports.userId, userId), eq(dataExports.id, id)));
    return row ? toRecord(row) : null;
  }

  async insert(userId: string, r: ExportRecord, keyHash: string | null): Promise<void> {
    await this.db.insert(dataExports).values({
      userId,
      id: r.id,
      status: r.status,
      requestedAt: new Date(r.requestedAt),
      readyAt: date(r.readyAt),
      expiresAt: date(r.expiresAt),
      downloadedAt: date(r.downloadedAt),
      keyHash,
      fileKey: r.fileKey,
      byteSize: r.byteSize,
    });
  }

  async claim(keyHash: string, now: number) {
    const at = new Date(now);
    const [claimed] = await this.db
      .update(dataExports)
      .set({ status: 'downloaded', downloadedAt: at })
      .where(
        and(
          eq(dataExports.keyHash, keyHash),
          eq(dataExports.status, 'ready'),
          isNull(dataExports.downloadedAt),
          sql`${dataExports.expiresAt} > ${at.toISOString()}::timestamptz`
        )
      )
      .returning();
    if (claimed) {
      return { userId: claimed.userId, export: toRecord(claimed) };
    }
    const [exists] = await this.db
      .select({ id: dataExports.id })
      .from(dataExports)
      .where(eq(dataExports.keyHash, keyHash));
    return exists ? ('gone' as const) : null;
  }
}

export class PostgresFileStorage implements FileStorage {
  constructor(private readonly db: Db) {}

  async put(key: string, bytes: Uint8Array, meta: { ownerId: string; contentType: string; expiresAt: number }) {
    await this.db.insert(storedFiles).values({
      key,
      ownerId: meta.ownerId,
      contentType: meta.contentType,
      bytes,
      createdAt: new Date(),
      expiresAt: new Date(meta.expiresAt),
    });
  }

  async get(key: string) {
    const [row] = await this.db
      .select({ bytes: storedFiles.bytes, contentType: storedFiles.contentType })
      .from(storedFiles)
      .where(eq(storedFiles.key, key));
    return row ? { bytes: new Uint8Array(row.bytes), contentType: row.contentType } : null;
  }

  async delete(key: string) {
    await this.db.delete(storedFiles).where(eq(storedFiles.key, key));
  }

  async purgeExpired(now: number) {
    await this.db.delete(storedFiles).where(lt(storedFiles.expiresAt, new Date(now)));
  }
}
