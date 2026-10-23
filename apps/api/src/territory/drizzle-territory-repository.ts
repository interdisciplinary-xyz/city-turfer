import type { ActivityType, BoundingBox } from '@cityturfer/core/shared-kernel';
import type { CellGrid, CellId, CellRow, Claim } from '@cityturfer/core/territory/ports';
import { and, asc, eq, ne, notExists, or, sql, type SQLWrapper } from 'drizzle-orm';

import type { ActivityTypeName } from '../backup/model';
import { activities, turfCells, turfClaims, users } from '../db/schema';
import type { Db } from '../db/store';
import type { TurfRepository, UnclaimedActivity } from './ports';

/**
 * A Postgres array literal of text (`{"a","b"}`), bound as **one** parameter and cast `::text[]`:
 * Drizzle's `sql` template would expand a JS array into one parameter per element (a 50k-cell
 * claim would exceed Postgres' 65,535 bind parameters). Checked on PGlite; drizzle binds it the same
 * way for the Neon driver (not run on Neon yet).
 */
export function textArray(values: Iterable<string>): string {
  const quoted: string[] = [];
  for (const v of values) {
    quoted.push(`"${v.replace(/[\\"]/g, (c) => `\\${c}`)}"`);
  }
  return `{${quoted.join(',')}}`;
}

/** Below this stored size a track is opened to count its points (`[]` is a few bytes). */
const TINY_TRACK_BYTES = 64;

const rowsOf = <T>(result: unknown): T[] => (result as { rows: T[] }).rows;

/**
 * The visit counts and canonical first claimer of the given cells (all when `only` is null),
 * recomputed from the user's claims, as rows of `turf_cells`. D4: the first claimer is the claim
 * with the earliest `(claimed_at, activity_id)`, ids in **JS string order** — `COLLATE "C"` is
 * load-bearing: Neon's default collation is linguistic, so without it the tie-break would differ
 * from the phone's.
 */
const recomputedRows = (userId: string, only: string | null) => sql`
  SELECT ${userId}::text AS user_id, c.cell,
    count(*) FILTER (WHERE k.type = 'walk')::int AS walk,
    count(*) FILTER (WHERE k.type = 'run')::int AS run,
    count(*) FILTER (WHERE k.type = 'cycle')::int AS cycle,
    min(k.claimed_at) AS first_at,
    (array_agg(k.activity_id ORDER BY k.claimed_at, k.activity_id COLLATE "C"))[1] AS first_activity_id
  FROM turf_claims k CROSS JOIN LATERAL unnest(k.cells) AS c(cell)
  WHERE k.user_id = ${userId}
    ${only === null ? sql`` : sql`AND k.cells && ${only}::text[] AND c.cell IN (SELECT unnest(${only}::text[]))`}
  GROUP BY c.cell`;

const recomputed = (userId: string, only: string | null) => sql`
  INSERT INTO turf_cells (user_id, cell, walk, run, cycle, first_at, first_activity_id)
  ${recomputedRows(userId, only)}`;

/**
 * The activity (its `user_id` and `id` columns) has a track to claim from: a track row with at least
 * one point. Uploads always carry ≥ 2; without one the core's claim returns without saving anything.
 * `pg_column_size` reads the stored size without fetching a toasted value, so only a tiny track (an
 * empty array, a repair case) is opened to count its points: `jsonb_array_length` on every track
 * would read and decompress each one in full (MBs) on every backlog query.
 */
export const hasTrack = (userId: SQLWrapper, activityId: SQLWrapper) => sql`EXISTS (
  SELECT 1 FROM activity_tracks t
  WHERE t.user_id = ${userId} AND t.activity_id = ${activityId}
    AND CASE WHEN pg_column_size(t.points) > ${TINY_TRACK_BYTES} THEN true ELSE jsonb_array_length(t.points) > 0 END)`;

/**
 * Territory's `TerritoryRepository` on Postgres, for one user inside that user's locked transaction
 * (`DrizzleBackupStore.write` + `lock()`). Claims store their cells (`text[]`); `turf_cells` is
 * the projection, rebuildable from them. No coordinates are stored: rows get their centroid from
 * the grid. Cell ids never reach a log or an error (they are location data).
 */
export class DrizzleTerritoryRepository implements TurfRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
    private readonly grid: CellGrid
  ) {}

  async claimExists(activityId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: turfClaims.activityId })
      .from(turfClaims)
      .where(and(eq(turfClaims.userId, this.userId), eq(turfClaims.activityId, activityId)))
      .limit(1);
    return !!row;
  }

  async existingCells(cells: Iterable<CellId>): Promise<Set<CellId>> {
    const list = [...cells];
    if (list.length === 0) {
      return new Set();
    }
    const result = await this.db.execute(sql`
      SELECT t.cell FROM unnest(${textArray(list)}::text[]) AS c(cell)
      JOIN turf_cells t ON t.user_id = ${this.userId} AND t.cell = c.cell`);
    return new Set(rowsOf<{ cell: string }>(result).map((r) => r.cell));
  }

  /**
   * Inserts the claim and adds its visits; a cell's first claimer becomes this claim when it sorts
   * before the current one (D4, canonical whatever the upload order). The arrival-order `newCells`
   * of the use case is ignored for that reason.
   */
  async saveClaim(claim: Claim): Promise<void> {
    const { activityId, type, claimedAt, cells } = claim.state;
    const sorted = [...cells].sort();
    const at = new Date(claimedAt).toISOString();
    await this.db.insert(turfClaims).values({
      userId: this.userId,
      activityId,
      type,
      claimedAt: new Date(claimedAt),
      cells: sorted,
      // The track this claim was made from: the activity row is written before its claim.
      trackHash: sql`(SELECT a.track_hash FROM activities a WHERE a.user_id = ${this.userId} AND a.id = ${activityId})`,
    });
    const earlier = sql`(excluded.first_at, excluded.first_activity_id COLLATE "C")
      < (turf_cells.first_at, turf_cells.first_activity_id COLLATE "C")`;
    await this.db.execute(sql`
      INSERT INTO turf_cells (user_id, cell, walk, run, cycle, first_at, first_activity_id)
      SELECT ${this.userId}, c.cell, ${type === 'walk' ? 1 : 0}::int, ${type === 'run' ? 1 : 0}::int,
        ${type === 'cycle' ? 1 : 0}::int, ${at}::timestamptz, ${activityId}
      FROM unnest(${textArray(sorted)}::text[]) AS c(cell)
      ON CONFLICT (user_id, cell) DO UPDATE SET
        walk = turf_cells.walk + excluded.walk,
        run = turf_cells.run + excluded.run,
        cycle = turf_cells.cycle + excluded.cycle,
        first_at = CASE WHEN ${earlier} THEN excluded.first_at ELSE turf_cells.first_at END,
        first_activity_id = CASE WHEN ${earlier} THEN excluded.first_activity_id ELSE turf_cells.first_activity_id END`);
    await this.bump();
  }

  /**
   * Deletes the claim and recomputes its cells from the remaining claims (counts, `first_at` and
   * the first claimer: never a deleted activity's). Call it **before** the activity is deleted: the
   * foreign key cascade would drop the claim and with it the list of cells to fix.
   */
  async releaseClaim(activityId: string): Promise<boolean> {
    const [gone] = await this.db
      .delete(turfClaims)
      .where(and(eq(turfClaims.userId, this.userId), eq(turfClaims.activityId, activityId)))
      .returning({ cells: turfClaims.cells });
    if (!gone) {
      return false;
    }
    const cells = textArray(gone.cells);
    await this.db.execute(sql`
      DELETE FROM turf_cells WHERE user_id = ${this.userId} AND cell IN (SELECT unnest(${cells}::text[]))`);
    await this.db.execute(recomputed(this.userId, cells));
    await this.bump();
    return true;
  }

  async cellsIn(bbox: BoundingBox, types: readonly ActivityType[]): Promise<CellRow[]> {
    // Not used by the server (the web derives views from `allCells`); kept for the port.
    const [w, s, e, n] = bbox;
    return (await this.allCells()).filter(
      (r) => r.lon >= w && r.lon <= e && r.lat >= s && r.lat <= n && types.some((t) => r[t] > 0)
    );
  }

  async allCells(): Promise<CellRow[]> {
    const rows = await this.db
      .select({
        cell: turfCells.cell,
        walk: turfCells.walk,
        run: turfCells.run,
        cycle: turfCells.cycle,
        firstAt: turfCells.firstAt,
      })
      .from(turfCells)
      .where(eq(turfCells.userId, this.userId));
    const grid = this.grid;
    return rows.map((r) => {
      let centroid: { lat: number; lon: number } | null = null;
      const at = () => (centroid ??= grid.centroid(r.cell));
      // The centroid only when a reader asks for it (summary and cell lists never do).
      return {
        cell: r.cell,
        walk: r.walk,
        run: r.run,
        cycle: r.cycle,
        firstAt: r.firstAt.getTime(),
        get lat() {
          return at().lat;
        },
        get lon() {
          return at().lon;
        },
      };
    });
  }

  async cellCounts({ offset, limit }: { offset: number; limit: number }) {
    // Ids in JS string order: `COLLATE "C"` (Neon's default collation is linguistic).
    const rows = await this.db
      .select({ cell: turfCells.cell, walk: turfCells.walk, run: turfCells.run, cycle: turfCells.cycle })
      .from(turfCells)
      .where(eq(turfCells.userId, this.userId))
      .orderBy(sql`${turfCells.cell} COLLATE "C"`)
      .limit(limit)
      .offset(offset);
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(turfCells)
      .where(eq(turfCells.userId, this.userId));
    return { rows, total: Number(count?.n ?? 0) };
  }

  async claimOf(activityId: string): Promise<{
    cellCount: number;
    newCellCount: number;
    newAreaM2: number;
    cells: { cell: CellId; isNew: boolean }[];
  } | null> {
    const result = await this.db.execute(sql`
      SELECT c.cell, (t.first_activity_id = k.activity_id) AS is_new
      FROM turf_claims k CROSS JOIN LATERAL unnest(k.cells) AS c(cell)
      JOIN turf_cells t ON t.user_id = k.user_id AND t.cell = c.cell
      WHERE k.user_id = ${this.userId} AND k.activity_id = ${activityId}
      ORDER BY c.cell COLLATE "C"`);
    const rows = rowsOf<{ cell: string; is_new: boolean }>(result);
    if (rows.length === 0) {
      return null;
    }
    let newCellCount = 0;
    let newAreaM2 = 0;
    for (const r of rows) {
      if (r.is_new) {
        newCellCount++;
        newAreaM2 += this.grid.areaM2(r.cell);
      }
    }
    return {
      cellCount: rows.length,
      newCellCount,
      newAreaM2,
      cells: rows.map((r) => ({ cell: r.cell, isNew: r.is_new })),
    };
  }

  async version(): Promise<number> {
    const [row] = await this.db.select({ v: users.turfVersion }).from(users).where(eq(users.id, this.userId));
    return row?.v ?? 0;
  }

  async rebuildAll(): Promise<void> {
    await this.db.delete(turfCells).where(eq(turfCells.userId, this.userId));
    await this.db.execute(recomputed(this.userId, null));
    await this.bump();
  }

  async eraseAll(): Promise<void> {
    await this.db.delete(turfClaims).where(eq(turfClaims.userId, this.userId));
    await this.db.delete(turfCells).where(eq(turfCells.userId, this.userId));
    await this.bump();
  }

  async unclaimed(limit: number, offset = 0): Promise<UnclaimedActivity[]> {
    const rows = await this.db
      .select({ id: activities.id, type: activities.type, startedAt: activities.startedAt })
      .from(activities)
      .where(
        and(
          eq(activities.userId, this.userId),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(turfClaims)
              .where(and(eq(turfClaims.userId, activities.userId), eq(turfClaims.activityId, activities.id)))
          ),
          hasTrack(activities.userId, activities.id)
        )
      )
      .orderBy(asc(activities.startedAt), sql`${activities.id} COLLATE "C"`)
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ id: r.id, type: r.type as ActivityTypeName, startedAt: r.startedAt.getTime() }));
  }

  async staleClaims(): Promise<UnclaimedActivity[]> {
    const rows = await this.db
      .select({ id: activities.id, type: activities.type, startedAt: activities.startedAt })
      .from(turfClaims)
      .innerJoin(activities, and(eq(activities.userId, turfClaims.userId), eq(activities.id, turfClaims.activityId)))
      .where(
        and(
          eq(turfClaims.userId, this.userId),
          or(
            ne(turfClaims.trackHash, activities.trackHash),
            ne(turfClaims.type, activities.type),
            ne(turfClaims.claimedAt, activities.startedAt)
          )
        )
      )
      .orderBy(asc(activities.startedAt), sql`${activities.id} COLLATE "C"`);
    return rows.map((r) => ({ id: r.id, type: r.type as ActivityTypeName, startedAt: r.startedAt.getTime() }));
  }

  async drift(): Promise<number> {
    const stored = sql`
      SELECT user_id, cell, walk, run, cycle, first_at, first_activity_id
      FROM turf_cells WHERE user_id = ${this.userId}`;
    const fresh = recomputedRows(this.userId, null);
    const result = await this.db.execute(sql`
      SELECT count(*)::int AS n FROM (
        ((${stored}) EXCEPT (${fresh})) UNION ALL ((${fresh}) EXCEPT (${stored}))
      ) d`);
    return Number(rowsOf<{ n: number }>(result)[0]?.n ?? 0);
  }

  private async bump(): Promise<void> {
    await this.db
      .update(users)
      .set({ turfVersion: sql`${users.turfVersion} + 1` })
      .where(eq(users.id, this.userId));
  }
}
