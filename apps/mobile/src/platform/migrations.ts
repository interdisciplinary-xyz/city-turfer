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
  {
    version: 5,
    sql: `
      -- Outbox retries and dead letters: a permanently failing event no longer blocks later ones.
      ALTER TABLE sys_outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sys_outbox ADD COLUMN last_error TEXT;
      -- next_attempt_at NULL: deliver now; otherwise retry not before this time (backoff)
      ALTER TABLE sys_outbox ADD COLUMN next_attempt_at INTEGER;
      -- dead_lettered_at NOT NULL: given up on, skipped by the dispatcher, pruned after 90 days
      ALTER TABLE sys_outbox ADD COLUMN dead_lettered_at INTEGER;
    `,
  },
  {
    version: 6,
    sql: `
      -- Health Sync (Apple Health): one settings row per user database
      CREATE TABLE hs_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        connected_at INTEGER,
        import_enabled INTEGER NOT NULL DEFAULT 1,
        export_enabled INTEGER NOT NULL DEFAULT 1,
        anchor TEXT,
        last_import TEXT
      );
      -- One Activity <-> one Apple Health workout. No foreign key: the link outlives a deleted
      -- Activity, so deleted imports are not imported again and recordings are not exported twice.
      CREATE TABLE hs_links (
        activity_id TEXT PRIMARY KEY,
        health_uuid TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('import', 'export')),
        at INTEGER NOT NULL,
        route_saved INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX hs_links_health_uuid ON hs_links (health_uuid);
      -- Workouts to import again (route not readable yet, or reading failed)
      CREATE TABLE hs_pending_imports (
        health_uuid TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1
      );
      -- Recordings waiting to be saved to Apple Health (foreground only)
      CREATE TABLE hs_pending_exports (
        activity_id TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
  {
    version: 7,
    sql: `
      -- Territory: the Home City (where the Turf Map opens), one row per user database.
      -- Only a catalogue id is stored, never coordinates.
      CREATE TABLE ter_home_city (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        city_id TEXT,
        chosen_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 8,
    sql: `
      -- Cloud Backup: one settings row per user database. The device token is NOT here
      -- (expo-secure-store); server_url is only a testing override (NULL: the built-in URL).
      CREATE TABLE cb_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        health_enabled INTEGER NOT NULL DEFAULT 0,
        server_url TEXT,
        cursor TEXT,                   -- last nextCursor of GET /v1/sync/changes
        backfilled_at INTEGER,         -- NULL: plan the first upload (again) on the next run
        home_city_pending INTEGER NOT NULL DEFAULT 0,
        withdrawals_pending TEXT,      -- consents withdrawn on the phone, not yet on the server (comma list)
        last_run_at INTEGER,
        last_error TEXT                -- an error code, never a message or a body
      );
      -- One row per Activity the backup knows about. No foreign key: a row outlives a deleted
      -- Activity so its DELETE can still be sent, and a server tombstone is never re-uploaded.
      CREATE TABLE cb_activities (
        activity_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,   -- upload order: oldest first
        status TEXT NOT NULL CHECK (status IN ('none', 'backed-up', 'deleted', 'gone', 'too-large', 'rejected')),
        op TEXT CHECK (op IN ('upload', 'replace', 'delete')),  -- NULL: nothing to send
        gaps_pending INTEGER NOT NULL DEFAULT 0,
        rev INTEGER NOT NULL DEFAULT 0,  -- +1 per queued change: a finished send clears only what it sent
        server_version INTEGER,
        uploaded_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER,
        error_code TEXT
      );
      CREATE INDEX idx_cb_activities_work ON cb_activities(started_at) WHERE op IS NOT NULL OR gaps_pending = 1;
    `,
  },
  {
    version: 9,
    sql: `
      -- Activity Log: the IANA zone the phone was in when the Activity was saved (NULL: unknown,
      -- filled once by a repair job) and when the Turfer last renamed it (NULL: never).
      ALTER TABLE log_activities ADD COLUMN time_zone TEXT;
      ALTER TABLE log_activities ADD COLUMN renamed_at INTEGER;
    `,
  },
  {
    version: 10,
    sql: `
      -- Cloud Backup: which server and account the state is about ('<server>|<account id>'; NULL:
      -- not known yet, adopted on the next run) and the chosenAt of the Home City the server has.
      ALTER TABLE cb_state ADD COLUMN account_key TEXT;
      ALTER TABLE cb_state ADD COLUMN home_city_sent_at INTEGER;
      -- A rename still to send (PATCH), and the gap-routes check time the server has from us.
      ALTER TABLE cb_activities ADD COLUMN rename_pending INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE cb_activities ADD COLUMN gaps_sent_at INTEGER;
      DROP INDEX idx_cb_activities_work;
      CREATE INDEX idx_cb_activities_work ON cb_activities(started_at)
        WHERE op IS NOT NULL OR gaps_pending = 1 OR rename_pending = 1;
    `,
  },
  {
    version: 11,
    sql: `
      -- Cloud Backup: Restore from the backup (one row), resumable after the app was killed.
      CREATE TABLE cb_restore (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'done')),
        total INTEGER NOT NULL DEFAULT 0,
        done INTEGER NOT NULL DEFAULT 0,
        has_home_city INTEGER NOT NULL DEFAULT 0,
        home_city_id TEXT,             -- a catalogue id (never coordinates); NULL with has_home_city: cleared
        home_city_chosen_at INTEGER,
        started_at INTEGER
      );
      -- The Activities still to bring back, from the server's manifest (deleted when handled).
      CREATE TABLE cb_restore_items (
        activity_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,   -- restore order: oldest first
        version INTEGER NOT NULL
      );
    `,
  },
];

/** The newest schema version this build knows. */
export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** `upTo` stops at a schema version (tests seeding an older database). */
export async function migrate(db: Database, upTo = Infinity): Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS sys_schema_version (version INTEGER NOT NULL)');
  const row = await db.first<{ version: number }>('SELECT MAX(version) AS version FROM sys_schema_version');
  const current = row?.version ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current || m.version > upTo) {
      continue;
    }
    await db.transaction(async (tx) => {
      for (const stmt of splitStatements(m.sql)) {
        await tx.run(stmt);
      }
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
