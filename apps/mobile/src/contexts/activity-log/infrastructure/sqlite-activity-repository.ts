import {
  Activity,
  type ActivityRepository,
  type ActivityState,
  estimatedTotals,
  type GapRoute,
} from '@cityturfer/core/activity-log/ports';

import { insertMany } from '@/platform/batch';
import type { Database } from '@/platform/database';
import { appendToOutbox } from '@/platform/outbox';
import type { TrackPoint } from '@/shared-kernel';

import type { ActivityDistanceEstimated, ActivityListItem } from '../contract';

type Row = {
  id: string;
  type: ActivityState['type'];
  name: string;
  started_at: number;
  ended_at: number;
  distance_m: number;
  moving_s: number;
  elapsed_s: number;
  elev_gain_m: number | null;
  splits: string;
  bbox: string | null;
  preview: string | null;
  estimated_m: number;
  estimated_moving_s: number;
};

/**
 * The `splits` column holds a JSON array of splits (older rows), or
 * `{ splits, resumedSegments }` since Resume vs GPS gap is tracked. Kept in this
 * existing column so no schema migration is needed; a later migration may move
 * `resumedSegments` into its own column.
 */
type StoredSplits = ActivityState['summary']['splits'] | SplitsWithBreaks;
interface SplitsWithBreaks {
  splits: ActivityState['summary']['splits'];
  resumedSegments: readonly number[] | null;
}

function readSplits(json: string): SplitsWithBreaks {
  const v = JSON.parse(json) as StoredSplits;
  return Array.isArray(v) ? { splits: v, resumedSegments: null } : (v as SplitsWithBreaks);
}

const writeSplits = (s: ActivityState): string =>
  JSON.stringify({ splits: s.summary.splits, resumedSegments: s.resumedSegments } satisfies SplitsWithBreaks);

function toState(r: Row): ActivityState {
  const stored = readSplits(r.splits);
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    summary: {
      distanceM: r.distance_m,
      movingS: r.moving_s,
      elapsedS: r.elapsed_s,
      elevGainM: r.elev_gain_m,
      splits: stored.splits,
    },
    bbox: r.bbox ? JSON.parse(r.bbox) : null,
    preview: r.preview ? JSON.parse(r.preview) : [],
    resumedSegments: stored.resumedSegments ?? null,
  };
}

export class SqliteActivityRepository implements ActivityRepository {
  constructor(private readonly db: Database) {}

  async exists(id: string) {
    return (await this.db.first('SELECT 1 AS x FROM log_activities WHERE id = ?', [id])) != null;
  }

  async get(id: string) {
    const r = await this.db.first<Row>('SELECT * FROM log_activities WHERE id = ?', [id]);
    return r ? Activity.rehydrate(toState(r)) : null;
  }

  async save(activity: Activity, track?: readonly TrackPoint[]) {
    const s = activity.toState();
    const events = activity.pullEvents();
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO log_activities (id, type, name, started_at, ended_at, distance_m, moving_s, elapsed_s, elev_gain_m, splits, bbox, preview, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
        [
          s.id,
          s.type,
          s.name,
          s.startedAt,
          s.endedAt,
          s.summary.distanceM,
          s.summary.movingS,
          s.summary.elapsedS,
          s.summary.elevGainM,
          writeSplits(s),
          s.bbox ? JSON.stringify(s.bbox) : null,
          JSON.stringify(s.preview),
          now,
        ]
      );
      if (track) {
        await insertMany(
          tx,
          'INSERT OR IGNORE INTO log_track_points (activity_id, seq, segment, t, lat, lon, alt, accuracy, speed)',
          track.map((p, seq) => [s.id, seq, p.segment, p.t, p.lat, p.lon, p.alt, p.accuracy, p.speed])
        );
      }
      await appendToOutbox(tx, events, now);
    });
  }

  async delete(activity: Activity) {
    const events = activity.pullEvents();
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM log_track_points WHERE activity_id = ?', [activity.id]);
      await tx.run('DELETE FROM log_activities WHERE id = ?', [activity.id]);
      await appendToOutbox(tx, events, Date.now());
    });
  }

  async overlapping(type: ActivityListItem['type'], startedAt: number, endedAt: number) {
    const rows = await this.db.all<{ id: string; started_at: number; ended_at: number }>(
      'SELECT id, started_at, ended_at FROM log_activities WHERE type = ? AND started_at < ? AND ended_at > ?',
      [type, endedAt, startedAt]
    );
    return rows.map((r) => ({ id: r.id, startedAt: r.started_at, endedAt: r.ended_at }));
  }

  async list(limit: number, before?: number): Promise<ActivityListItem[]> {
    const rows = await this.db.all<Row>(
      `SELECT id, type, name, started_at, distance_m, moving_s, estimated_m, estimated_moving_s, preview FROM log_activities
       ${before != null ? 'WHERE started_at < ?' : ''} ORDER BY started_at DESC LIMIT ?`,
      before != null ? [before, limit] : [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      startedAt: r.started_at,
      distanceM: r.distance_m + r.estimated_m,
      movingS: r.moving_s + r.estimated_moving_s,
      estimatedDistanceM: r.estimated_m,
      preview: r.preview ? JSON.parse(r.preview) : [],
    }));
  }

  async saveCorrection(activity: Activity, track: readonly TrackPoint[]) {
    const s = activity.toState();
    const events = activity.pullEvents();
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await tx.run(
        `UPDATE log_activities SET distance_m = ?, moving_s = ?, elapsed_s = ?, elev_gain_m = ?, splits = ?, bbox = ?, preview = ?
         WHERE id = ?`,
        [
          s.summary.distanceM,
          s.summary.movingS,
          s.summary.elapsedS,
          s.summary.elevGainM,
          writeSplits(s),
          s.bbox ? JSON.stringify(s.bbox) : null,
          JSON.stringify(s.preview),
          s.id,
        ]
      );
      await tx.run('DELETE FROM log_track_points WHERE activity_id = ?', [s.id]);
      // Segments changed: gap routes must be estimated again.
      await tx.run('DELETE FROM log_gap_routes WHERE activity_id = ?', [s.id]);
      await tx.run(
        'UPDATE log_activities SET estimated_m = 0, estimated_moving_s = 0, gaps_checked_at = NULL WHERE id = ?',
        [s.id]
      );
      await insertMany(
        tx,
        'INSERT INTO log_track_points (activity_id, seq, segment, t, lat, lon, alt, accuracy, speed)',
        track.map((p, seq) => [s.id, seq, p.segment, p.t, p.lat, p.lon, p.alt, p.accuracy, p.speed])
      );
      await appendToOutbox(tx, events, now);
    });
  }

  async idsWithUncheckedGaps(): Promise<string[]> {
    const rows = await this.db.all<{ id: string }>(
      'SELECT id FROM log_activities WHERE gaps_checked_at IS NULL ORDER BY started_at'
    );
    return rows.map((r) => r.id);
  }

  async typeOf(id: string) {
    return (
      (await this.db.first<{ type: Row['type'] }>('SELECT type FROM log_activities WHERE id = ?', [id]))?.type ?? null
    );
  }

  async saveGapRoutes(id: string, routes: readonly GapRoute[], now: number) {
    const totals = estimatedTotals(routes);
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM log_gap_routes WHERE activity_id = ?', [id]);
      for (const r of routes) {
        await tx.run(
          'INSERT INTO log_gap_routes (activity_id, after_segment, distance_m, moving_s, coords) VALUES (?, ?, ?, ?, ?)',
          [id, r.afterSegment, r.distanceM, Math.round(r.movingS), JSON.stringify(r.coords)]
        );
      }
      await tx.run(
        'UPDATE log_activities SET estimated_m = ?, estimated_moving_s = ?, gaps_checked_at = ? WHERE id = ?',
        [totals.distanceM, totals.movingS, now, id]
      );
      const event: ActivityDistanceEstimated = {
        type: 'ActivityDistanceEstimated',
        v: 1,
        at: now,
        activityId: id,
        estimatedDistanceM: totals.distanceM,
      };
      await appendToOutbox(tx, [event], now);
    });
  }

  async gapRoutesOf(id: string): Promise<GapRoute[]> {
    const rows = await this.db.all<{ after_segment: number; distance_m: number; moving_s: number; coords: string }>(
      'SELECT after_segment, distance_m, moving_s, coords FROM log_gap_routes WHERE activity_id = ? ORDER BY after_segment',
      [id]
    );
    return rows.map((r) => ({
      afterSegment: r.after_segment,
      distanceM: r.distance_m,
      movingS: r.moving_s,
      coords: JSON.parse(r.coords),
    }));
  }

  async gapsCheckedAt(id: string): Promise<number | null> {
    const r = await this.db.first<{ at: number | null }>(
      'SELECT gaps_checked_at AS at FROM log_activities WHERE id = ?',
      [id]
    );
    return r?.at ?? null;
  }

  async allIds(): Promise<string[]> {
    return (await this.db.all<{ id: string }>('SELECT id FROM log_activities ORDER BY started_at')).map((r) => r.id);
  }

  trackOf(id: string): Promise<TrackPoint[]> {
    return this.db.all<TrackPoint>(
      'SELECT segment, t, lat, lon, alt, accuracy, speed FROM log_track_points WHERE activity_id = ? ORDER BY seq',
      [id]
    );
  }
}
