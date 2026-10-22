import { DomainError } from '@/shared-kernel';

/**
 * Why the last backup run stopped, in codes the UI turns into plain words:
 * `no-token` no device token yet · `auth` the server refused the token · `consent` the server has no
 * backup consent · `offline` no connection · `server` the server failed · `not-ready` the server
 * doesn't offer backup yet (501) · `busy` rate limited · `outdated` the server wants a newer app.
 */
export type BackupErrorCode =
  'no-token' | 'auth' | 'consent' | 'offline' | 'server' | 'not-ready' | 'busy' | 'outdated';

/** The consents Cloud Backup records on the server (contract: ConsentPurpose). */
export type ConsentPurpose = 'cloud-sync' | 'apple-health-in-cloud-sync';

export interface BackupSettingsState {
  readonly enabled: boolean;
  /** Apple Health imports (`hk-…`) are uploaded too: a separate consent (decision D2). */
  readonly healthIncluded: boolean;
  /** Testing override of the server URL; null: the built-in one. */
  readonly serverUrl: string | null;
  /** Last `nextCursor` of the changes feed. */
  readonly cursor: string | null;
  /** When the history was last compared with the server; null: plan the first upload on the next run. */
  readonly backfilledAt: number | null;
  readonly homeCityPending: boolean;
  /** Consents withdrawn on the phone that the server has not heard about yet. */
  readonly withdrawalsPending: readonly ConsentPurpose[];
  readonly lastRunAt: number | null;
  readonly lastError: BackupErrorCode | null;
}

const URL_PATTERN = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/;

const without = (list: readonly ConsentPurpose[], p: ConsentPurpose) => list.filter((x) => x !== p);
const withPurpose = (list: readonly ConsentPurpose[], p: ConsentPurpose) => [...without(list, p), p];

/**
 * The user's backup decision and the progress of the backup as a whole (one per user database).
 * Invariants: nothing is queued while backup is off; turning it off also stops Apple Health uploads
 * and keeps both withdrawals until the server has them; Apple Health needs backup on.
 */
export class BackupSettings {
  private constructor(private state: BackupSettingsState) {}

  static initial(): BackupSettings {
    return new BackupSettings({
      enabled: false,
      healthIncluded: false,
      serverUrl: null,
      cursor: null,
      backfilledAt: null,
      homeCityPending: false,
      withdrawalsPending: [],
      lastRunAt: null,
      lastError: null,
    });
  }

  static rehydrate(state: BackupSettingsState): BackupSettings {
    return new BackupSettings(state);
  }

  toState(): BackupSettingsState {
    return this.state;
  }

  get enabled(): boolean {
    return this.state.enabled;
  }

  get healthIncluded(): boolean {
    return this.state.healthIncluded;
  }

  get withdrawalsPending(): readonly ConsentPurpose[] {
    return this.state.withdrawalsPending;
  }

  /** Changes made while backup is off are not queued: turning it on compares the whole history. */
  get acceptsChanges(): boolean {
    return this.state.enabled;
  }

  get needsPlanning(): boolean {
    return this.state.enabled && this.state.backfilledAt == null;
  }

  get homeCityPending(): boolean {
    return this.state.enabled && this.state.homeCityPending;
  }

  /** The server refused the token: no more requests until a new one is saved. */
  get waitsForNewToken(): boolean {
    return this.state.lastError === 'auth';
  }

  /** The server recorded the backup consent: start (or restart) with a full comparison. */
  enable(): void {
    this.state = {
      ...this.state,
      enabled: true,
      withdrawalsPending: without(this.state.withdrawalsPending, 'cloud-sync'),
      backfilledAt: null,
      lastError: null,
    };
  }

  /** Stops at once; the server is told (both consents withdrawn) now or on a later run. */
  disable(): void {
    this.state = {
      ...this.state,
      enabled: false,
      healthIncluded: false,
      homeCityPending: false,
      withdrawalsPending: withPurpose(
        withPurpose(this.state.withdrawalsPending, 'cloud-sync'),
        'apple-health-in-cloud-sync'
      ),
      lastError: null,
    };
  }

  withdrawalDelivered(purpose: ConsentPurpose): void {
    this.state = { ...this.state, withdrawalsPending: without(this.state.withdrawalsPending, purpose) };
  }

  /**
   * Apple Health imports in or out. On: only after the server recorded that consent; the history is
   * compared again so earlier imports go up too. Off: at once, the server is told now or later.
   */
  includeHealth(on: boolean): void {
    if (!this.state.enabled) {
      throw new DomainError('backup.off');
    }
    const p: ConsentPurpose = 'apple-health-in-cloud-sync';
    this.state = on
      ? {
          ...this.state,
          healthIncluded: true,
          backfilledAt: null,
          withdrawalsPending: without(this.state.withdrawalsPending, p),
        }
      : { ...this.state, healthIncluded: false, withdrawalsPending: withPurpose(this.state.withdrawalsPending, p) };
  }

  /** A testing server (or null: back to the built-in one). Another server means comparing again. */
  useServer(url: string | null): void {
    const trimmed = url?.trim().replace(/\/+$/, '') || null;
    if (trimmed != null && !URL_PATTERN.test(trimmed)) {
      throw new DomainError('backup.invalid-server-url');
    }
    this.state = { ...this.state, serverUrl: trimmed, backfilledAt: null, cursor: null, lastError: null };
  }

  /** The token may only be forgotten while backup is off: turning backup off needs it to tell the server. */
  ensureTokenRemovable(): void {
    if (this.state.enabled) {
      throw new DomainError('backup.on');
    }
  }

  /** A new device token (maybe another account): forget the auth error and compare again. */
  tokenChanged(): void {
    this.state = { ...this.state, backfilledAt: null, cursor: null, lastError: null };
  }

  planned(now: number, cursor: string | null): void {
    this.state = { ...this.state, backfilledAt: now, cursor: cursor ?? this.state.cursor };
  }

  queueHomeCity(): void {
    if (this.acceptsChanges) {
      this.state = { ...this.state, homeCityPending: true };
    }
  }

  homeCityDelivered(): void {
    this.state = { ...this.state, homeCityPending: false };
  }

  runFinished(now: number, error: BackupErrorCode | null): void {
    this.state = { ...this.state, lastRunAt: now, lastError: error };
  }
}
