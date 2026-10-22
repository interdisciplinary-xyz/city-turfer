import { and, desc, eq, gt, isNull, lt, notInArray } from 'drizzle-orm';

import type { ExportRecord, ExportStatus, ExportStore, FileStorage } from '../privacy/ports';
import { dataExports, storedFiles, users } from './schema';
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

const mine = (userId: string, id: string) => and(eq(dataExports.userId, userId), eq(dataExports.id, id));

export class DrizzleExportStore implements ExportStore {
  constructor(private readonly db: Db) {}

  reserve(userId: string, r: ExportRecord, windowMs: number) {
    return this.db.transaction(async (tx) => {
      // The user's row lock serialises this user's export requests (and every other write).
      await tx.insert(users).values({ id: userId }).onConflictDoNothing();
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      const [last] = await tx
        .select()
        .from(dataExports)
        .where(
          and(
            eq(dataExports.userId, userId),
            notInArray(dataExports.status, ['failed', 'expired']),
            gt(dataExports.requestedAt, new Date(r.requestedAt - windowMs))
          )
        )
        .orderBy(desc(dataExports.requestedAt))
        .limit(1);
      if (last) {
        return { reserved: false as const, last: toRecord(last) };
      }
      await tx
        .insert(dataExports)
        .values({ userId, id: r.id, status: 'pending', requestedAt: new Date(r.requestedAt) });
      return { reserved: true as const };
    });
  }

  async complete(
    userId: string,
    id: string,
    d: { readyAt: number; expiresAt: number; fileKey: string; byteSize: number; keyHash: string }
  ) {
    await this.db
      .update(dataExports)
      .set({
        status: 'ready',
        readyAt: new Date(d.readyAt),
        expiresAt: new Date(d.expiresAt),
        fileKey: d.fileKey,
        byteSize: d.byteSize,
        keyHash: d.keyHash,
      })
      .where(mine(userId, id));
  }

  async fail(userId: string, id: string) {
    await this.db.update(dataExports).set({ status: 'failed', fileKey: null, keyHash: null }).where(mine(userId, id));
  }

  async get(userId: string, id: string): Promise<ExportRecord | null> {
    const [row] = await this.db.select().from(dataExports).where(mine(userId, id));
    return row ? toRecord(row) : null;
  }

  async byKeyHash(keyHash: string) {
    const [row] = await this.db.select().from(dataExports).where(eq(dataExports.keyHash, keyHash));
    return row ? { userId: row.userId, export: toRecord(row) } : null;
  }

  async markDownloaded(userId: string, id: string, at: number) {
    await this.db
      .update(dataExports)
      .set({ downloadedAt: new Date(at) })
      .where(and(mine(userId, id), isNull(dataExports.downloadedAt)));
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
