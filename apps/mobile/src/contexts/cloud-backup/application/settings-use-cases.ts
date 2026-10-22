import type { BackupCommandResult, BackupStatus } from '../contract';
import { deviceToken, mayUpload } from '../domain/backup-policy';
import { deliverWithdrawals, errorOf, openClient } from './backup-access';
import type { CloudBackupDeps } from './ports';

const OK: BackupCommandResult = { kind: 'ok' };

export class GetBackupStatus {
  constructor(
    private readonly d: CloudBackupDeps,
    private readonly running: () => boolean
  ) {}
  async execute(): Promise<BackupStatus> {
    const s = await this.d.repo.settings();
    const st = s.toState();
    const eligible = new Set(
      (await this.d.activities.timeline()).map((a) => a.id).filter((id) => mayUpload(id, s.healthIncluded))
    );
    const count = (ids: string[]) => ids.filter((id) => eligible.has(id)).length;
    const token = await this.d.tokens.read().catch(() => null);
    return {
      enabled: s.enabled,
      healthIncluded: s.healthIncluded,
      hasToken: token != null,
      serverUrl: st.serverUrl ?? this.d.defaultServerUrl,
      serverUrlOverridden: st.serverUrl != null,
      backedUp: count(await this.d.repo.backedUpIds()),
      total: eligible.size,
      refused: count(await this.d.repo.refusedIds()),
      running: this.running(),
      lastRunAt: st.lastRunAt,
      lastError: st.lastError,
    };
  }
}

/** Saves the device token the founder pasted (trimmed); a new token clears an "invalid token" stop. */
export class SaveDeviceToken {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(token: string): Promise<void> {
    await this.d.tokens.save(deviceToken(token));
    await this.d.repo.updateSettings((s) => s.tokenChanged());
  }
}

/** Forgets the device token. Only while backup is off (turning it off needs the token to tell the server). */
export class RemoveDeviceToken {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(): Promise<void> {
    (await this.d.repo.settings()).ensureTokenRemovable();
    await this.d.tokens.clear();
  }
}

/** The testing server override (null or empty: the built-in server). */
export class UseBackupServer {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(url: string | null): Promise<void> {
    await this.d.repo.updateSettings((s) => s.useServer(url));
  }
}

/** "Back up to CityTurfer cloud" on: records the consent on the server first, then turns backup on. */
export class EnableBackup {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(): Promise<BackupCommandResult> {
    const api = await openClient(this.d, await this.d.repo.settings());
    if (!api) {
      return { kind: 'failed', error: 'no-token' };
    }
    const r = await api.setConsent('cloud-sync', true, this.d.policyVersion);
    if (!r.ok) {
      return { kind: 'failed', error: errorOf(r.failure) };
    }
    await this.d.repo.updateSettings((s) => s.enable());
    return OK;
  }
}

/** Off: stops at once on the phone, then withdraws the consents on the server (or on a later run). */
export class DisableBackup {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(): Promise<BackupCommandResult> {
    const s = await this.d.repo.updateSettings((x) => x.disable());
    const api = await openClient(this.d, s);
    const error = api ? await deliverWithdrawals(this.d, api, s) : 'no-token';
    return error ? { kind: 'failed', error } : OK;
  }
}

/** "Include Apple Health workouts": on needs the server's consent first; off is immediate. */
export class IncludeHealthWorkouts {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(on: boolean): Promise<BackupCommandResult> {
    if (!on) {
      const s = await this.d.repo.updateSettings((x) => x.includeHealth(false));
      const api = await openClient(this.d, s);
      const error = api ? await deliverWithdrawals(this.d, api, s) : 'no-token';
      return error ? { kind: 'failed', error } : OK;
    }
    const s = await this.d.repo.settings();
    s.includeHealth(true); // checks the rule (backup must be on) before asking the server
    const api = await openClient(this.d, s);
    if (!api) {
      return { kind: 'failed', error: 'no-token' };
    }
    const r = await api.setConsent('apple-health-in-cloud-sync', true, this.d.policyVersion);
    if (!r.ok) {
      return { kind: 'failed', error: errorOf(r.failure) };
    }
    await this.d.repo.updateSettings((x) => x.includeHealth(true));
    return OK;
  }
}
