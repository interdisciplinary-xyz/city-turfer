import type { CellId, CellRow, Claim, TerritoryRepository } from '@cityturfer/core/territory/ports';

import { insertMany } from '@/platform/batch';
import type { Database } from '@/platform/database';
import { appendToOutbox } from '@/platform/outbox';
import type { ActivityType, BoundingBox } from '@/shared-kernel';

import type { TurfReleased } from '../contract';

type Row = { cell: string; lat: number; lon: number; walk: number; run: number; cycle: number; first_at: number };
const toCellRow = (r: Row): CellRow => ({
  cell: r.cell,
  lat: r.lat,
  lon: r.lon,
  walk: r.walk,
  run: r.run,
  cycle: r.cycle,
  firstAt: r.first_at,
});
const TYPE_COLUMNS: readonly ActivityType[] = ['walk', 'run', 'cycle'];

export class SqliteTerritoryRepository implements TerritoryRepository {
  constructor(private readonly db: Database) {}

  async claimExists(activityId: string) {
    return (await this.db.first('SELECT 1 AS x FROM ter_claims WHERE activity_id = ?', [activityId])) != null;
  }

  async existingCells(cells: Iterable<CellId>) {
    const all = [...cells];
    const found = new Set<CellId>();
    for (let i = 0; i < all.length; i += 500) {
      const chunk = all.slice(i, i + 500);
      const rows = await this.db.all<{ cell: string }>(
        `SELECT cell FROM ter_cells WHERE cell IN (${chunk.map(() => '?').join(',')})`,
        chunk
      );
      rows.forEach((r) => found.add(r.cell));
    }
    return found;
  }

  async saveClaim(
    claim: Claim,
    newCells: ReadonlySet<CellId>,
    centroids: Map<CellId, { lat: number; lon: number }>,
    areas: Map<CellId, number>
  ) {
    const { activityId, type, claimedAt, cells } = claim.state;
    if (!TYPE_COLUMNS.includes(type)) {
      throw new Error(`unknown type ${type}`);
    }
    const events = claim.pullEvents();
    let newArea = 0;
    for (const c of newCells) {
      newArea += areas.get(c) ?? 0;
    }
    await this.db.transaction(async (tx) => {
      await tx.run(
        'INSERT INTO ter_claims (activity_id, type, claimed_at, cell_count, new_cell_count, new_area_m2) VALUES (?, ?, ?, ?, ?, ?)',
        [activityId, type, claimedAt, cells.size, newCells.size, newArea]
      );
      await insertMany(
        tx,
        'INSERT INTO ter_claim_cells (activity_id, cell, is_new)',
        [...cells].map((c) => [activityId, c, newCells.has(c) ? 1 : 0])
      );
      // New cells: insert with zero visits; then increment every claimed cell (order-independent).
      await insertMany(
        tx,
        'INSERT OR IGNORE INTO ter_cells (cell, lat, lon, visits, first_at, last_at)',
        [...newCells].map((c) => [c, centroids.get(c)!.lat, centroids.get(c)!.lon, 0, claimedAt, claimedAt])
      );
      const all = [...cells];
      for (let i = 0; i < all.length; i += 500) {
        const chunk = all.slice(i, i + 500);
        await tx.run(
          `UPDATE ter_cells SET visits = visits + 1, ${type} = ${type} + 1,
             first_at = MIN(first_at, ?), last_at = MAX(last_at, ?)
           WHERE cell IN (${chunk.map(() => '?').join(',')})`,
          [claimedAt, claimedAt, ...chunk]
        );
      }
      await appendToOutbox(tx, events, Date.now());
    });
  }

  async releaseClaim(activityId: string, now: number) {
    const claim = await this.db.first<{ type: ActivityType }>('SELECT type FROM ter_claims WHERE activity_id = ?', [
      activityId,
    ]);
    if (!claim || !TYPE_COLUMNS.includes(claim.type)) {
      return false;
    }
    const event: TurfReleased = { type: 'TurfReleased', v: 1, at: now, activityId };
    await this.db.transaction(async (tx) => {
      await tx.run(
        `UPDATE ter_cells SET visits = visits - 1, ${claim.type} = ${claim.type} - 1
         WHERE cell IN (SELECT cell FROM ter_claim_cells WHERE activity_id = ?)`,
        [activityId]
      );
      await tx.run('DELETE FROM ter_cells WHERE visits <= 0');
      await tx.run('DELETE FROM ter_claim_cells WHERE activity_id = ?', [activityId]);
      await tx.run('DELETE FROM ter_claims WHERE activity_id = ?', [activityId]);
      await appendToOutbox(tx, [event], now);
    });
    return true;
  }

  async cellsIn(bbox: BoundingBox, types: readonly ActivityType[]) {
    const [w, s, e, n] = bbox;
    const typeFilter =
      types
        .filter((t) => TYPE_COLUMNS.includes(t))
        .map((t) => `${t} > 0`)
        .join(' OR ') || '0';
    const rows = await this.db.all<Row>(
      `SELECT cell, lat, lon, walk, run, cycle, first_at FROM ter_cells
       WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND (${typeFilter})`,
      [s, n, w, e]
    );
    return rows.map(toCellRow);
  }

  async allCells() {
    return (await this.db.all<Row>('SELECT cell, lat, lon, walk, run, cycle, first_at FROM ter_cells')).map(toCellRow);
  }

  async claimOf(activityId: string) {
    const c = await this.db.first<{ cell_count: number; new_cell_count: number; new_area_m2: number }>(
      'SELECT cell_count, new_cell_count, new_area_m2 FROM ter_claims WHERE activity_id = ?',
      [activityId]
    );
    if (!c) {
      return null;
    }
    const cells = await this.db.all<{ cell: string; is_new: number }>(
      'SELECT cell, is_new FROM ter_claim_cells WHERE activity_id = ?',
      [activityId]
    );
    return {
      cellCount: c.cell_count,
      newCellCount: c.new_cell_count,
      newAreaM2: c.new_area_m2,
      cells: cells.map((r) => ({ cell: r.cell, isNew: r.is_new === 1 })),
    };
  }
}
