import { insertMany } from '@/platform/batch';
import type { Database } from '@/platform/database';
import { appendToOutbox } from '@/platform/outbox';
import type { TrackPoint } from '@/shared-kernel';

import type { ActivityListItem } from '../contract';
import { Activity, type ActivityState } from '../domain/Activity';
import type { ActivityRepository } from '../domain/ActivityRepository';

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
};

const toState = (r: Row): ActivityState => ({
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
    splits: JSON.parse(r.splits),
  },
  bbox: r.bbox ? JSON.parse(r.bbox) : null,
  preview: r.preview ? JSON.parse(r.preview) : [],
});

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
          JSON.stringify(s.summary.splits),
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

  async list(limit: number, before?: number): Promise<ActivityListItem[]> {
    const rows = await this.db.all<Row>(
      `SELECT id, type, name, started_at, distance_m, moving_s, preview FROM log_activities
       ${before != null ? 'WHERE started_at < ?' : ''} ORDER BY started_at DESC LIMIT ?`,
      before != null ? [before, limit] : [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      startedAt: r.started_at,
      distanceM: r.distance_m,
      movingS: r.moving_s,
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
          JSON.stringify(s.summary.splits),
          s.bbox ? JSON.stringify(s.bbox) : null,
          JSON.stringify(s.preview),
          s.id,
        ]
      );
      await tx.run('DELETE FROM log_track_points WHERE activity_id = ?', [s.id]);
      await insertMany(
        tx,
        'INSERT INTO log_track_points (activity_id, seq, segment, t, lat, lon, alt, accuracy, speed)',
        track.map((p, seq) => [s.id, seq, p.segment, p.t, p.lat, p.lon, p.alt, p.accuracy, p.speed])
      );
      await appendToOutbox(tx, events, now);
    });
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
