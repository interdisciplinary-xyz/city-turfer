import { insertMany } from '@/platform/batch';
import type { Database } from '@/platform/database';
import { appendToOutbox } from '@/platform/outbox';
import type { TrackPoint } from '@/shared-kernel';

import { RecordingSession, type RecordingSessionState } from '../domain/recording-session';
import type { RecordingSessionRepository } from '../domain/recording-session-repository';

type PointRow = {
  segment: number;
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
  accuracy: number | null;
  speed: number | null;
};

export class SqliteRecordingSessionRepository implements RecordingSessionRepository {
  constructor(private readonly db: Database) {}

  async getActive() {
    const row = await this.db.first<{ state: string }>(
      "SELECT state FROM rec_sessions WHERE status IN ('recording','paused','autoPaused') ORDER BY started_at DESC LIMIT 1"
    );
    return row ? RecordingSession.rehydrate(JSON.parse(row.state) as RecordingSessionState) : null;
  }

  async get(id: string) {
    const row = await this.db.first<{ state: string }>('SELECT state FROM rec_sessions WHERE id = ?', [id]);
    return row ? RecordingSession.rehydrate(JSON.parse(row.state) as RecordingSessionState) : null;
  }

  async save(session: RecordingSession, newPoints: readonly TrackPoint[]) {
    const s = session.toState();
    const events = session.pullEvents();
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO rec_sessions (id, type, status, state, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, state = excluded.state, updated_at = excluded.updated_at`,
        [s.id, s.type, s.status, JSON.stringify(s), s.startedAt, now]
      );
      const firstSeq = session.firstSeqOf(newPoints.length);
      await insertMany(
        tx,
        'INSERT INTO rec_track_points (session_id, seq, segment, t, lat, lon, alt, accuracy, speed)',
        newPoints.map((p, i) => [s.id, firstSeq + i, p.segment, p.t, p.lat, p.lon, p.alt, p.accuracy, p.speed])
      );
      // A discarded session's track is deleted with the state change, never left behind on a crash.
      if (s.status === 'discarded') await tx.run('DELETE FROM rec_track_points WHERE session_id = ?', [s.id]);
      await appendToOutbox(tx, events, now);
    });
  }

  async pointsOf(sessionId: string): Promise<TrackPoint[]> {
    return this.db.all<PointRow>(
      'SELECT segment, t, lat, lon, alt, accuracy, speed FROM rec_track_points WHERE session_id = ? ORDER BY seq',
      [sessionId]
    );
  }

  async purgePoints(sessionId: string) {
    await this.db.run('DELETE FROM rec_track_points WHERE session_id = ?', [sessionId]);
  }

  async scrubClosedSessions() {
    return this.db.transaction(async (tx) => {
      const rows = await tx.all<{ id: string; state: string }>(
        "SELECT id, state FROM rec_sessions WHERE status IN ('finished','discarded')"
      );
      let scrubbed = 0;
      for (const r of rows) {
        const state = JSON.parse(r.state) as RecordingSessionState;
        if (state.tail == null && !state.recent?.length) continue;
        await tx.run('UPDATE rec_sessions SET state = ? WHERE id = ?', [
          JSON.stringify({ ...state, tail: null, recent: [] }),
          r.id,
        ]);
        scrubbed++;
      }
      await tx.run(
        "DELETE FROM rec_track_points WHERE session_id IN (SELECT id FROM rec_sessions WHERE status = 'discarded')"
      );
      return scrubbed;
    });
  }
}
