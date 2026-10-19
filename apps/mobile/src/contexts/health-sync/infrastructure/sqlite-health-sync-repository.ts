import type { Database, SqlExecutor } from '@/platform/database';

import type { HealthSyncRepository } from '../application/ports';
import {
  type HealthLink,
  type HealthSyncState,
  type ImportReport,
  INITIAL_HEALTH_SYNC_STATE,
  type PendingExport,
  type PendingImport,
} from '../domain/health-sync-state';

interface StateRow {
  connected_at: number | null;
  import_enabled: number;
  export_enabled: number;
  anchor: string | null;
  last_import: string | null;
}

interface LinkRow {
  activity_id: string;
  health_uuid: string;
  direction: 'import' | 'export';
  at: number;
  route_saved: number;
}

const toLink = (r: LinkRow): HealthLink => ({
  activityId: r.activity_id,
  healthUuid: r.health_uuid,
  direction: r.direction,
  at: r.at,
  routeSaved: r.route_saved === 1,
});

function parseReport(json: string | null): ImportReport | null {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as ImportReport;
  } catch {
    return null;
  }
}

async function readState(ex: SqlExecutor): Promise<HealthSyncState> {
  const r = await ex.first<StateRow>('SELECT * FROM hs_state WHERE id = 1');
  if (!r) {
    return INITIAL_HEALTH_SYNC_STATE;
  }
  return {
    connectedAt: r.connected_at,
    importEnabled: r.import_enabled === 1,
    exportEnabled: r.export_enabled === 1,
    anchor: r.anchor,
    lastImport: parseReport(r.last_import),
  };
}

/** Tables hs_state (one row) and hs_links (migration 6). */
export class SqliteHealthSyncRepository implements HealthSyncRepository {
  constructor(private readonly db: Database) {}

  state(): Promise<HealthSyncState> {
    return readState(this.db);
  }

  async saveState(patch: Partial<HealthSyncState>): Promise<void> {
    await this.db.transaction(async (tx) => {
      const s = { ...(await readState(tx)), ...patch };
      await tx.run(
        `INSERT INTO hs_state (id, connected_at, import_enabled, export_enabled, anchor, last_import)
         VALUES (1, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET connected_at = excluded.connected_at, import_enabled = excluded.import_enabled,
           export_enabled = excluded.export_enabled, anchor = excluded.anchor, last_import = excluded.last_import`,
        [
          s.connectedAt,
          s.importEnabled ? 1 : 0,
          s.exportEnabled ? 1 : 0,
          s.anchor,
          s.lastImport ? JSON.stringify(s.lastImport) : null,
        ]
      );
    });
  }

  async linkOf(activityId: string): Promise<HealthLink | null> {
    const r = await this.db.first<LinkRow>('SELECT * FROM hs_links WHERE activity_id = ?', [activityId]);
    return r ? toLink(r) : null;
  }

  async linkOfHealthUuid(healthUuid: string): Promise<HealthLink | null> {
    const r = await this.db.first<LinkRow>('SELECT * FROM hs_links WHERE health_uuid = ?', [healthUuid]);
    return r ? toLink(r) : null;
  }

  async saveLink(l: HealthLink): Promise<void> {
    await this.db.run(
      `INSERT INTO hs_links (activity_id, health_uuid, direction, at, route_saved) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(activity_id) DO NOTHING`,
      [l.activityId, l.healthUuid, l.direction, l.at, l.routeSaved ? 1 : 0]
    );
  }

  async pendingImports(): Promise<PendingImport[]> {
    const rows = await this.db.all<{
      health_uuid: string;
      type: PendingImport['type'];
      started_at: number;
      ended_at: number;
      attempts: number;
    }>('SELECT * FROM hs_pending_imports ORDER BY ended_at');
    return rows.map((r) => ({
      healthUuid: r.health_uuid,
      type: r.type,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      attempts: r.attempts,
    }));
  }

  async savePendingImport(p: PendingImport): Promise<void> {
    await this.db.run(
      `INSERT INTO hs_pending_imports (health_uuid, type, started_at, ended_at, attempts) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(health_uuid) DO UPDATE SET attempts = excluded.attempts`,
      [p.healthUuid, p.type, p.startedAt, p.endedAt, p.attempts]
    );
  }

  async removePendingImport(healthUuid: string): Promise<void> {
    await this.db.run('DELETE FROM hs_pending_imports WHERE health_uuid = ?', [healthUuid]);
  }

  async pendingExports(): Promise<PendingExport[]> {
    const rows = await this.db.all<{ activity_id: string; attempts: number }>(
      'SELECT activity_id, attempts FROM hs_pending_exports ORDER BY rowid'
    );
    return rows.map((r) => ({ activityId: r.activity_id, attempts: r.attempts }));
  }

  async queueExport(activityId: string): Promise<void> {
    await this.db.run('INSERT INTO hs_pending_exports (activity_id) VALUES (?) ON CONFLICT(activity_id) DO NOTHING', [
      activityId,
    ]);
  }

  async saveExportAttempt(activityId: string, attempts: number): Promise<void> {
    await this.db.run('UPDATE hs_pending_exports SET attempts = ? WHERE activity_id = ?', [attempts, activityId]);
  }

  async removePendingExport(activityId: string): Promise<void> {
    await this.db.run('DELETE FROM hs_pending_exports WHERE activity_id = ?', [activityId]);
  }
}
