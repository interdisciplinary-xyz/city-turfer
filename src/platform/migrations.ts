import type { Database } from './database';

/**
 * Ordered, append-only. Never edit a shipped migration — add a new one.
 * Tables are prefixed by owning context: rec_ (Recording), log_ (Activity Log),
 * ter_ (Territory), sys_ (platform).
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE sys_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        processed_at INTEGER
      );
      CREATE INDEX idx_outbox_pending ON sys_outbox(processed_at) WHERE processed_at IS NULL;

      CREATE TABLE rec_sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        state TEXT NOT NULL,           -- JSON snapshot of the aggregate (tail, totals, timers)
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_rec_sessions_status ON rec_sessions(status);
      CREATE TABLE rec_track_points (
        session_id TEXT NOT NULL REFERENCES rec_sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        segment INTEGER NOT NULL,
        t INTEGER NOT NULL,
        lat REAL NOT NULL, lon REAL NOT NULL,
        alt REAL, accuracy REAL, speed REAL,
        PRIMARY KEY (session_id, seq)
      ) WITHOUT ROWID;

      CREATE TABLE log_activities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        distance_m REAL NOT NULL,
        moving_s INTEGER NOT NULL,
        elapsed_s INTEGER NOT NULL,
        elev_gain_m REAL,
        splits TEXT NOT NULL,          -- JSON
        bbox TEXT,                     -- JSON [w,s,e,n]
        preview TEXT,                  -- JSON [[lon,lat],...] simplified
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_log_activities_started ON log_activities(started_at DESC);
      CREATE TABLE log_track_points (
        activity_id TEXT NOT NULL REFERENCES log_activities(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        segment INTEGER NOT NULL,
        t INTEGER NOT NULL,
        lat REAL NOT NULL, lon REAL NOT NULL,
        alt REAL, accuracy REAL, speed REAL,
        PRIMARY KEY (activity_id, seq)
      ) WITHOUT ROWID;

      CREATE TABLE ter_claims (
        activity_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        claimed_at INTEGER NOT NULL,
        cell_count INTEGER NOT NULL,
        new_cell_count INTEGER NOT NULL,
        new_area_m2 REAL NOT NULL
      );
      CREATE TABLE ter_claim_cells (
        activity_id TEXT NOT NULL REFERENCES ter_claims(activity_id) ON DELETE CASCADE,
        cell TEXT NOT NULL,
        is_new INTEGER NOT NULL,
        PRIMARY KEY (activity_id, cell)
      ) WITHOUT ROWID;
      CREATE TABLE ter_cells (
        cell TEXT PRIMARY KEY,
        lat REAL NOT NULL, lon REAL NOT NULL,   -- centroid, for viewport queries
        visits INTEGER NOT NULL,
        walk INTEGER NOT NULL DEFAULT 0,
        run INTEGER NOT NULL DEFAULT 0,
        cycle INTEGER NOT NULL DEFAULT 0,
        first_at INTEGER NOT NULL,
        last_at INTEGER NOT NULL
      ) WITHOUT ROWID;
      CREATE INDEX idx_ter_cells_lat_lon ON ter_cells(lat, lon);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE sys_diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        kind TEXT NOT NULL,            -- launch | app-state | batch | task-error
        data TEXT NOT NULL             -- JSON; never raw coordinates
      );
      CREATE INDEX idx_diagnostics_at ON sys_diagnostics(at);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE sys_jobs (
        name TEXT PRIMARY KEY,         -- one-off maintenance job, e.g. a data repair
        done_at INTEGER NOT NULL,
        result TEXT                    -- JSON summary
      );
    `,
  },
  {
    version: 4,
    sql: `
      ALTER TABLE log_activities ADD COLUMN estimated_m REAL NOT NULL DEFAULT 0;
      ALTER TABLE log_activities ADD COLUMN estimated_moving_s INTEGER NOT NULL DEFAULT 0;
      -- gaps_checked_at NULL: gap routes not estimated yet
      ALTER TABLE log_activities ADD COLUMN gaps_checked_at INTEGER;
      CREATE TABLE log_gap_routes (
        activity_id TEXT NOT NULL REFERENCES log_activities(id) ON DELETE CASCADE,
        after_segment INTEGER NOT NULL,
        distance_m REAL NOT NULL,
        moving_s INTEGER NOT NULL,
        coords TEXT NOT NULL,          -- JSON [[lon,lat],...] street route across the gap (display only, never turf)
        PRIMARY KEY (activity_id, after_segment)
      ) WITHOUT ROWID;
    `,
  },
];

export async function migrate(db: Database): Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS sys_schema_version (version INTEGER NOT NULL)');
  const row = await db.first<{ version: number }>('SELECT MAX(version) AS version FROM sys_schema_version');
  const current = row?.version ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.transaction(async (tx) => {
      for (const stmt of splitStatements(m.sql)) await tx.run(stmt);
      await tx.run('INSERT INTO sys_schema_version (version) VALUES (?)', [m.version]);
    });
  }
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);
}
