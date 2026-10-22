import type { Database, SqlExecutor } from '@/platform/database';

import type { BackupRepository } from '../application/ports';
import { ActivityBackup, type BackupOp, type ServerCopy } from '../domain/activity-backup';
import { type BackupErrorCode, BackupSettings, type ConsentPurpose } from '../domain/backup-settings';

interface StateRow {
  enabled: number;
  health_enabled: number;
  server_url: string | null;
  cursor: string | null;
  backfilled_at: number | null;
  home_city_pending: number;
  withdrawals_pending: string | null;
  last_run_at: number | null;
  last_error: string | null;
}

interface ActivityRow {
  activity_id: string;
  started_at: number;
  status: ServerCopy;
  op: BackupOp | null;
  gaps_pending: number;
  rev: number;
  server_version: number | null;
  uploaded_at: number | null;
  attempts: number;
  next_attempt_at: number | null;
  error_code: string | null;
}

const PURPOSES: readonly ConsentPurpose[] = ['cloud-sync', 'apple-health-in-cloud-sync'];

async function readSettings(ex: SqlExecutor): Promise<BackupSettings> {
  const r = await ex.first<StateRow>('SELECT * FROM cb_state WHERE id = 1');
  if (!r) {
    return BackupSettings.initial();
  }
  return BackupSettings.rehydrate({
    enabled: r.enabled === 1,
    healthIncluded: r.health_enabled === 1,
    serverUrl: r.server_url,
    cursor: r.cursor,
    backfilledAt: r.backfilled_at,
    homeCityPending: r.home_city_pending === 1,
    withdrawalsPending: (r.withdrawals_pending ?? '')
      .split(',')
      .filter((p): p is ConsentPurpose => (PURPOSES as readonly string[]).includes(p)),
    lastRunAt: r.last_run_at,
    lastError: r.last_error as BackupErrorCode | null,
  });
}

async function writeSettings(ex: SqlExecutor, settings: BackupSettings): Promise<void> {
  const s = settings.toState();
  await ex.run(
    `INSERT INTO cb_state (id, enabled, health_enabled, server_url, cursor, backfilled_at, home_city_pending,
       withdrawals_pending, last_run_at, last_error)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, health_enabled = excluded.health_enabled,
       server_url = excluded.server_url, cursor = excluded.cursor, backfilled_at = excluded.backfilled_at,
       home_city_pending = excluded.home_city_pending, withdrawals_pending = excluded.withdrawals_pending,
       last_run_at = excluded.last_run_at, last_error = excluded.last_error`,
    [
      s.enabled ? 1 : 0,
      s.healthIncluded ? 1 : 0,
      s.serverUrl,
      s.cursor,
      s.backfilledAt,
      s.homeCityPending ? 1 : 0,
      s.withdrawalsPending.length > 0 ? s.withdrawalsPending.join(',') : null,
      s.lastRunAt,
      s.lastError,
    ]
  );
}

const toBackup = (r: ActivityRow): ActivityBackup =>
  ActivityBackup.rehydrate({
    activityId: r.activity_id,
    startedAt: r.started_at,
    status: r.status,
    op: r.op,
    gapsPending: r.gaps_pending === 1,
    rev: r.rev,
    serverVersion: r.server_version,
    uploadedAt: r.uploaded_at,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    errorCode: r.error_code,
  });

async function readBackup(ex: SqlExecutor, id: string): Promise<ActivityBackup | null> {
  const r = await ex.first<ActivityRow>('SELECT * FROM cb_activities WHERE activity_id = ?', [id]);
  return r ? toBackup(r) : null;
}

async function writeBackup(ex: SqlExecutor, b: ActivityBackup): Promise<void> {
  const s = b.toState();
  await ex.run(
    `INSERT INTO cb_activities (activity_id, started_at, status, op, gaps_pending, rev, server_version, uploaded_at,
       attempts, next_attempt_at, error_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(activity_id) DO UPDATE SET started_at = excluded.started_at, status = excluded.status,
       op = excluded.op, gaps_pending = excluded.gaps_pending, rev = excluded.rev,
       server_version = excluded.server_version, uploaded_at = excluded.uploaded_at, attempts = excluded.attempts,
       next_attempt_at = excluded.next_attempt_at, error_code = excluded.error_code`,
    [
      s.activityId,
      s.startedAt,
      s.status,
      s.op,
      s.gapsPending ? 1 : 0,
      s.rev,
      s.serverVersion,
      s.uploadedAt,
      s.attempts,
      s.nextAttemptAt,
      s.errorCode,
    ]
  );
}

/** Tables cb_state (one row) and cb_activities (migration 8). Every change is a read-modify-write in one transaction. */
export class SqliteBackupRepository implements BackupRepository {
  constructor(private readonly db: Database) {}

  settings(): Promise<BackupSettings> {
    return readSettings(this.db);
  }

  updateSettings(change: (s: BackupSettings) => void): Promise<BackupSettings> {
    return this.db.transaction(async (tx) => {
      const s = await readSettings(tx);
      change(s);
      await writeSettings(tx, s);
      return s;
    });
  }

  backupOf(activityId: string): Promise<ActivityBackup | null> {
    return readBackup(this.db, activityId);
  }

  updateBackup(activityId: string, startedAt: number, change: (b: ActivityBackup) => void): Promise<ActivityBackup> {
    return this.db.transaction(async (tx) => {
      const b = (await readBackup(tx, activityId)) ?? ActivityBackup.track(activityId, startedAt);
      change(b);
      await writeBackup(tx, b);
      return b;
    });
  }

  async updateBackups(
    items: readonly { id: string; startedAt: number }[],
    change: (b: ActivityBackup) => void
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        const b = (await readBackup(tx, item.id)) ?? ActivityBackup.track(item.id, item.startedAt);
        change(b);
        await writeBackup(tx, b);
      }
    });
  }

  async withWork(): Promise<ActivityBackup[]> {
    const rows = await this.db.all<ActivityRow>(
      'SELECT * FROM cb_activities WHERE op IS NOT NULL OR gaps_pending = 1 ORDER BY started_at, activity_id'
    );
    return rows.map(toBackup);
  }

  async backedUpIds(): Promise<string[]> {
    const rows = await this.db.all<{ id: string }>(
      "SELECT activity_id AS id FROM cb_activities WHERE status = 'backed-up' AND (op IS NULL OR op = 'delete')"
    );
    return rows.map((r) => r.id);
  }

  async refusedIds(): Promise<string[]> {
    const rows = await this.db.all<{ id: string }>(
      "SELECT activity_id AS id FROM cb_activities WHERE status IN ('too-large', 'rejected')"
    );
    return rows.map((r) => r.id);
  }
}
