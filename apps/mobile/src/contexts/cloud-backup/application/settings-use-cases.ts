import type { BackupCommandResult, BackupStatus } from '../contract';
import { deviceToken, mayUpload } from '../domain/backup-policy';
import { connect, deliverWithdrawals, errorOf } from './backup-access';
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
    const credentials = this.d.available ? await this.d.credentials.current().catch(() => null) : null;
    const deviceToken = this.d.available ? await this.d.tokens.read().catch(() => null) : null;
    const backedUp = count(await this.d.repo.backedUpIds());
    return {
      available: this.d.available,
      enabled: s.enabled,
      healthIncluded: s.healthIncluded,
      hasToken: credentials != null,
      hasDeviceToken: deviceToken != null,
      unsynced: s.enabled ? (await this.d.repo.withWork()).length : 0,
      serverUrl: st.serverUrl ?? this.d.defaultServerUrl,
      serverUrlOverridden: st.serverUrl != null,
      backedUp,
      total: eligible.size,
      refused: count(await this.d.repo.refusedIds()),
      running: this.running(),
      lastRunAt: st.lastRunAt,
      lastError: st.lastError,
    };
  }
}

/** Saves the device token the founder pasted in Developer tools (trimmed); the server says whose it is. */
export class SaveDeviceToken {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(token: string): Promise<void> {
    if (!this.d.available) {
      return;
    }
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

/** Waits until no backup run is in flight (it may be delivering a withdrawal). */
type WhenIdle = () => Promise<void>;

/**
 * "Back up to CityTurfer cloud" on: records the consent on the server first, then turns backup on.
 * Waits for a running backup first, so a withdrawal it is delivering can't land after this consent.
 */
export class EnableBackup {
  constructor(
    private readonly d: CloudBackupDeps,
    private readonly whenIdle: WhenIdle
  ) {}
  async execute(): Promise<BackupCommandResult> {
    await this.whenIdle();
    const c = await connect(this.d, await this.d.repo.settings());
    if (c.kind !== 'connected') {
      return { kind: 'failed', error: c.kind === 'failed' ? c.error : 'auth' };
    }
    const r = await c.api.setConsent('cloud-sync', true, this.d.policyVersion);
    if (!r.ok) {
      return { kind: 'failed', error: errorOf(r.failure) };
    }
    await this.d.repo.updateSettings((s) => s.enable());
    return OK;
  }
}

/**
 * Off: stops at once on the phone, then withdraws the consents on the server (now or on a later
 * run). The server then erases its copy; nothing on the phone is deleted.
 */
export class DisableBackup {
  constructor(private readonly d: CloudBackupDeps) {}
  async execute(): Promise<BackupCommandResult> {
    if (!this.d.available) {
      return { kind: 'failed', error: 'not-available' };
    }
    const s = await this.d.repo.updateSettings((x) => x.disable());
    return withdraw(this.d, s);
  }
}

async function withdraw(d: CloudBackupDeps, s: Parameters<typeof connect>[1]): Promise<BackupCommandResult> {
  const c = await connect(d, s);
  if (c.kind !== 'connected') {
    return { kind: 'failed', error: c.kind === 'failed' ? c.error : 'auth' };
  }
  const error = await deliverWithdrawals(d, c.api, c.settings);
  return error ? { kind: 'failed', error } : OK;
}

/** "Include Apple Health workouts": on needs the server's consent first; off is immediate. */
export class IncludeHealthWorkouts {
  constructor(
    private readonly d: CloudBackupDeps,
    private readonly whenIdle: WhenIdle
  ) {}
  async execute(on: boolean): Promise<BackupCommandResult> {
    if (!this.d.available) {
      return { kind: 'failed', error: 'not-available' };
    }
    if (!on) {
      return withdraw(this.d, await this.d.repo.updateSettings((x) => x.includeHealth(false)));
    }
    await this.whenIdle();
    const s = await this.d.repo.settings();
    s.includeHealth(true); // checks the rule (backup must be on) before asking the server
    const c = await connect(this.d, s);
    if (c.kind !== 'connected') {
      return { kind: 'failed', error: c.kind === 'failed' ? c.error : 'auth' };
    }
    const r = await c.api.setConsent('apple-health-in-cloud-sync', true, this.d.policyVersion);
    if (!r.ok) {
      return { kind: 'failed', error: errorOf(r.failure) };
    }
    await this.d.repo.updateSettings((x) => x.includeHealth(true));
    return OK;
  }
}
