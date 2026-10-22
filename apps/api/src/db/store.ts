import { and, asc, desc, eq, gt, inArray, like, lt, notInArray, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import type {
  ActivityRecord,
  ActivitySourceName,
  ActivityTypeName,
  ChangeRecord,
  CompactPoint,
  ConsentPurposeName,
  ConsentRecord,
  GapRoutesRecord,
  HomeCityRecord,
  TombstoneRecord,
  UserRecord,
} from '../backup/model';
import type { BackupStore, UserReader, UserWriter } from '../backup/ports';
import {
  activities,
  activityTracks,
  authUsers,
  authVerifications,
  consents,
  dataExports,
  gapRoutes,
  homeCities,
  storedFiles,
  tombstones,
  users,
} from './schema';

/** A LIKE pattern matching `text` literally. */
const likeEscaped = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** A Drizzle Postgres database or transaction: Neon in production, PGlite in tests and dev. */
export type Db = PgDatabase<PgQueryResultHKT>;

type ActivityRow = typeof activities.$inferSelect;

const toActivity = (r: ActivityRow): ActivityRecord => ({
  id: r.id,
  type: r.type as ActivityTypeName,
  name: r.name,
  renamedAt: r.renamedAt?.getTime() ?? null,
  source: r.source as ActivitySourceName,
  startedAt: r.startedAt.getTime(),
  endedAt: r.endedAt.getTime(),
  timeZone: r.timeZone,
  resumedSegments: r.resumedSegments ?? null,
  trackHash: r.trackHash,
  contentHash: r.contentHash,
  summary: r.summary,
  estimatedDistanceM: r.estimatedDistanceM,
  estimatedMovingS: r.estimatedMovingS,
  version: r.version,
  updatedAt: r.updatedAt.getTime(),
  changeSeq: r.changeSeq,
});

const activityRow = (userId: string, a: ActivityRecord) => ({
  userId,
  id: a.id,
  type: a.type,
  name: a.name,
  renamedAt: a.renamedAt === null ? null : new Date(a.renamedAt),
  source: a.source,
  startedAt: new Date(a.startedAt),
  endedAt: new Date(a.endedAt),
  timeZone: a.timeZone,
  resumedSegments: a.resumedSegments,
  trackHash: a.trackHash,
  contentHash: a.contentHash,
  summary: a.summary,
  estimatedDistanceM: a.estimatedDistanceM,
  estimatedMovingS: a.estimatedMovingS,
  version: a.version,
  updatedAt: new Date(a.updatedAt),
  changeSeq: a.changeSeq,
});

/** Every query of one user, on a database or inside a transaction. */
class UserScope implements UserWriter {
  constructor(
    private readonly db: Db,
    private readonly userId: string
  ) {}

  async user(): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, this.userId));
    return row
      ? { id: row.id, email: row.email, displayName: row.displayName, createdAt: row.createdAt.getTime() }
      : null;
  }

  async consents(): Promise<ConsentRecord[]> {
    const rows = await this.db
      .select()
      .from(consents)
      .where(eq(consents.userId, this.userId))
      .orderBy(asc(consents.purpose));
    return rows.map((r) => ({
      purpose: r.purpose as ConsentPurposeName,
      granted: r.granted,
      policyVersion: r.policyVersion,
      at: r.decidedAt.getTime(),
    }));
  }

  async activity(id: string): Promise<ActivityRecord | null> {
    const [row] = await this.db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, this.userId), eq(activities.id, id)));
    return row ? toActivity(row) : null;
  }

  async tombstone(id: string): Promise<TombstoneRecord | null> {
    const [row] = await this.db
      .select()
      .from(tombstones)
      .where(and(eq(tombstones.userId, this.userId), eq(tombstones.activityId, id)));
    return row ? { activityId: row.activityId, deletedAt: row.deletedAt.getTime(), changeSeq: row.changeSeq } : null;
  }

  async track(id: string): Promise<CompactPoint[] | null> {
    const [row] = await this.db
      .select({ points: activityTracks.points })
      .from(activityTracks)
      .where(and(eq(activityTracks.userId, this.userId), eq(activityTracks.activityId, id)));
    return row?.points ?? null;
  }

  async gapRoutes(id: string): Promise<GapRoutesRecord | null> {
    const [row] = await this.db
      .select()
      .from(gapRoutes)
      .where(and(eq(gapRoutes.userId, this.userId), eq(gapRoutes.activityId, id)));
    return row ? { checkedAt: row.checkedAt.getTime(), routes: row.routes } : null;
  }

  async tracksOf(ids: readonly string[]): Promise<Map<string, CompactPoint[]>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ id: activityTracks.activityId, points: activityTracks.points })
      .from(activityTracks)
      .where(and(eq(activityTracks.userId, this.userId), inArray(activityTracks.activityId, [...ids])));
    return new Map(rows.map((r) => [r.id, r.points]));
  }

  async gapRoutesOf(ids: readonly string[]): Promise<Map<string, GapRoutesRecord>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select()
      .from(gapRoutes)
      .where(and(eq(gapRoutes.userId, this.userId), inArray(gapRoutes.activityId, [...ids])));
    return new Map(rows.map((r) => [r.activityId, { checkedAt: r.checkedAt.getTime(), routes: r.routes }]));
  }

  async homeCity(): Promise<HomeCityRecord | null> {
    const [row] = await this.db.select().from(homeCities).where(eq(homeCities.userId, this.userId));
    return row
      ? {
          cityId: row.cityId,
          chosenAt: row.chosenAt.getTime(),
          recordedAt: row.recordedAt.getTime(),
          changeSeq: row.changeSeq,
        }
      : null;
  }

  async listActivities(q: {
    limit: number;
    type?: ActivityTypeName;
    before?: { startedAt: number; id: string };
  }): Promise<ActivityRecord[]> {
    const before = q.before
      ? or(
          lt(activities.startedAt, new Date(q.before.startedAt)),
          and(eq(activities.startedAt, new Date(q.before.startedAt)), lt(activities.id, q.before.id))
        )
      : undefined;
    const rows = await this.db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, this.userId), q.type ? eq(activities.type, q.type) : undefined, before))
      .orderBy(desc(activities.startedAt), desc(activities.id))
      .limit(q.limit);
    return rows.map(toActivity);
  }

  async changesSince(afterSeq: number, limit: number): Promise<ChangeRecord[]> {
    const [upserts, deletes, home] = await Promise.all([
      this.db
        .select()
        .from(activities)
        .where(and(eq(activities.userId, this.userId), gt(activities.changeSeq, afterSeq)))
        .orderBy(asc(activities.changeSeq))
        .limit(limit),
      this.db
        .select()
        .from(tombstones)
        .where(and(eq(tombstones.userId, this.userId), gt(tombstones.changeSeq, afterSeq)))
        .orderBy(asc(tombstones.changeSeq))
        .limit(limit),
      this.db
        .select()
        .from(homeCities)
        .where(and(eq(homeCities.userId, this.userId), gt(homeCities.changeSeq, afterSeq))),
    ]);
    const changes: ChangeRecord[] = [
      ...upserts.map((r): ChangeRecord => ({ kind: 'activity', seq: r.changeSeq, activity: toActivity(r) })),
      ...deletes.map((r): ChangeRecord => ({
        kind: 'tombstone',
        seq: r.changeSeq,
        tombstone: { activityId: r.activityId, deletedAt: r.deletedAt.getTime(), changeSeq: r.changeSeq },
      })),
      ...home.map((r): ChangeRecord => ({
        kind: 'home-city',
        seq: r.changeSeq,
        homeCity: {
          cityId: r.cityId,
          chosenAt: r.chosenAt.getTime(),
          recordedAt: r.recordedAt.getTime(),
          changeSeq: r.changeSeq,
        },
      })),
    ];
    return changes.sort((a, b) => a.seq - b.seq).slice(0, limit);
  }

  async currentSeq(): Promise<number> {
    const [row] = await this.db.select({ seq: users.changeSeq }).from(users).where(eq(users.id, this.userId));
    return row?.seq ?? 0;
  }

  async lock(): Promise<void> {
    // The middleware caches users it has seen per instance; after an erasure elsewhere the row may
    // be gone: re-create it (empty account) instead of failing on the foreign keys.
    await this.db.insert(users).values({ id: this.userId }).onConflictDoNothing();
    await this.db.select({ id: users.id }).from(users).where(eq(users.id, this.userId)).for('update');
  }

  async nextSeq(): Promise<number> {
    const [row] = await this.db
      .update(users)
      .set({ changeSeq: sql`${users.changeSeq} + 1` })
      .where(eq(users.id, this.userId))
      .returning({ seq: users.changeSeq });
    if (!row) {
      throw new Error('unknown user');
    }
    return row.seq;
  }

  async putConsent(c: ConsentRecord): Promise<void> {
    const values = { granted: c.granted, policyVersion: c.policyVersion, decidedAt: new Date(c.at) };
    await this.db
      .insert(consents)
      .values({ userId: this.userId, purpose: c.purpose, ...values })
      .onConflictDoUpdate({ target: [consents.userId, consents.purpose], set: values });
  }

  async insertActivity(a: ActivityRecord, points: CompactPoint[]): Promise<void> {
    await this.db.insert(activities).values(activityRow(this.userId, a));
    await this.db.insert(activityTracks).values({ userId: this.userId, activityId: a.id, points });
  }

  async updateActivity(a: ActivityRecord, points?: CompactPoint[]): Promise<void> {
    // The key columns are set to the values they already have.
    await this.db
      .update(activities)
      .set(activityRow(this.userId, a))
      .where(and(eq(activities.userId, this.userId), eq(activities.id, a.id)));
    if (points) {
      await this.db
        .update(activityTracks)
        .set({ points })
        .where(and(eq(activityTracks.userId, this.userId), eq(activityTracks.activityId, a.id)));
    }
  }

  async deleteActivity(id: string): Promise<void> {
    // Track and gap routes go with it (ON DELETE CASCADE).
    await this.db.delete(activities).where(and(eq(activities.userId, this.userId), eq(activities.id, id)));
  }

  async putTombstone(t: TombstoneRecord): Promise<void> {
    await this.db
      .insert(tombstones)
      .values({
        userId: this.userId,
        activityId: t.activityId,
        deletedAt: new Date(t.deletedAt),
        changeSeq: t.changeSeq,
      })
      .onConflictDoNothing();
  }

  async putGapRoutes(activityId: string, routes: GapRoutesRecord | null): Promise<void> {
    if (!routes) {
      await this.db
        .delete(gapRoutes)
        .where(and(eq(gapRoutes.userId, this.userId), eq(gapRoutes.activityId, activityId)));
      return;
    }
    const values = { checkedAt: new Date(routes.checkedAt), routes: routes.routes };
    await this.db
      .insert(gapRoutes)
      .values({ userId: this.userId, activityId, ...values })
      .onConflictDoUpdate({ target: [gapRoutes.userId, gapRoutes.activityId], set: values });
  }

  async eraseBackup(scope: 'apple-health' | 'all'): Promise<number> {
    const mine = eq(activities.userId, this.userId);
    // Tracks and gap routes go with their activity (ON DELETE CASCADE).
    const gone = await this.db
      .delete(activities)
      .where(scope === 'all' ? mine : and(mine, or(like(activities.id, 'hk-%'), eq(activities.source, 'apple-health'))))
      .returning({ id: activities.id });
    if (scope === 'all') {
      // Tombstones stay (ids and times only, no location data): delete wins (D5) across a
      // withdrawal, so a phone still holding a deleted activity gets 410 instead of re-uploading
      // it. They go with the account (eraseAccount).
      await this.db.delete(homeCities).where(eq(homeCities.userId, this.userId));
    }
    // Export zips hold copies of the same data: delete them and expire their links, in this
    // transaction (Postgres FileStorage; a Blob adapter will need its own delete).
    await this.db.delete(storedFiles).where(eq(storedFiles.ownerId, this.userId));
    await this.db
      .update(dataExports)
      .set({ status: 'expired', fileKey: null })
      .where(and(eq(dataExports.userId, this.userId), notInArray(dataExports.status, ['failed', 'expired'])));
    return gone.length;
  }

  async putHomeCity(h: HomeCityRecord): Promise<void> {
    const values = {
      cityId: h.cityId,
      chosenAt: new Date(h.chosenAt),
      recordedAt: new Date(h.recordedAt),
      changeSeq: h.changeSeq,
    };
    await this.db
      .insert(homeCities)
      .values({ userId: this.userId, ...values })
      .onConflictDoUpdate({ target: homeCities.userId, set: values });
  }
}

/** The BackupStore adapter over Drizzle. Queries always carry the user id (multi-tenant). */
export class DrizzleBackupStore implements BackupStore {
  constructor(private readonly db: Db) {}

  read(userId: string): UserReader {
    return new UserScope(this.db, userId);
  }

  /**
   * READ COMMITTED on purpose (Postgres' default, pinned so a changed database default cannot
   * break it): every statement sees what committed before it started, so reads after `lock()` see
   * the last write of the user that held the lock — a consent withdrawal included. A snapshot
   * level (REPEATABLE READ) would keep the reads from before the lock wait.
   */
  write<T>(userId: string, fn: (tx: UserWriter) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => fn(new UserScope(tx as unknown as Db, userId)), {
      isolationLevel: 'read committed',
    });
  }

  async eraseAccount(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [auth] = await tx.delete(authUsers).where(eq(authUsers.id, userId)).returning({ email: authUsers.email });
      if (auth) {
        // A pending code is keyed `<type>-otp-<email>` (Better Auth emailOTP).
        await tx
          .delete(authVerifications)
          .where(like(authVerifications.identifier, `%-otp-${likeEscaped(auth.email)}`));
      }
      // Everything else hangs off users (ON DELETE CASCADE): consents, activities → tracks and gap
      // routes, tombstones, the Home City, exports. Sessions went with auth_users.
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  async ensureUser(user: UserRecord): Promise<void> {
    await this.db
      .insert(users)
      .values({ id: user.id, email: user.email, displayName: user.displayName })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`coalesce(${users.email}, excluded.email)`,
          displayName: sql`coalesce(${users.displayName}, excluded.display_name)`,
        },
      });
  }

  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }
}
