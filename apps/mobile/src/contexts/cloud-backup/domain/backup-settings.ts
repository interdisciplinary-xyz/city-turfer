import { DomainError } from '@/shared-kernel';

/**
 * Why the last backup run stopped, in codes the UI turns into plain words:
 * `no-token` not signed in (no account token yet) · `not-available` this profile never backs up (demo) · `auth` the server refused the token · `consent` the server has no
 * backup consent · `offline` no connection · `server` the server failed · `not-ready` the server
 * doesn't offer backup yet (501) · `busy` rate limited · `outdated` the server wants a newer app.
 */
export type BackupErrorCode =
  'no-token' | 'auth' | 'consent' | 'offline' | 'server' | 'not-ready' | 'busy' | 'outdated' | 'not-available';

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
  /** The server and account this state is about (`<server>|<account id>`); null: not known yet. */
  readonly accountKey: string | null;
  /** `chosenAt` of the Home City choice the server has from us; null: none. */
  readonly homeCitySentAt: number | null;
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
      accountKey: null,
      homeCitySentAt: null,
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

  /**
   * The server has the withdrawal and has erased what it covered (contract: no tombstones). Without
   * `cloud-sync` nothing of ours is on the server any more: turning backup on again uploads everything.
   */
  withdrawalDelivered(purpose: ConsentPurpose): void {
    const s = this.state;
    const withdrawalsPending = without(s.withdrawalsPending, purpose);
    this.state =
      purpose === 'cloud-sync'
        ? { ...s, withdrawalsPending, cursor: null, backfilledAt: null, homeCityPending: false, homeCitySentAt: null }
        : { ...s, withdrawalsPending };
  }

  /**
   * Which server and account the backup talks to now. The first one is adopted as is (state from
   * before this was tracked); another one means nothing of this state is true there: backup goes
   * off (that account has not consented) and starts from scratch. Returns whether it was reset.
   */
  useAccount(key: string): boolean {
    const s = this.state;
    if (s.accountKey === key) {
      return false;
    }
    if (s.accountKey == null) {
      this.state = { ...s, accountKey: key };
      return false;
    }
    this.state = {
      ...BackupSettings.initial().state,
      serverUrl: s.serverUrl,
      lastRunAt: s.lastRunAt,
      accountKey: key,
    };
    return true;
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

  /** A Home City choice made at `chosenAt` goes up, unless the server already has that one. */
  queueHomeCity(chosenAt: number | null): void {
    if (this.acceptsChanges && (chosenAt == null || chosenAt !== this.state.homeCitySentAt)) {
      this.state = { ...this.state, homeCityPending: true };
    }
  }

  homeCityDelivered(chosenAt: number | null): void {
    this.state = { ...this.state, homeCityPending: false, homeCitySentAt: chosenAt ?? this.state.homeCitySentAt };
  }

  /** Restore: the server's Home City choice is applied here, so it is not sent back. */
  homeCityRestored(chosenAt: number): void {
    this.state = { ...this.state, homeCitySentAt: chosenAt };
  }

  runFinished(now: number, error: BackupErrorCode | null): void {
    this.state = { ...this.state, lastRunAt: now, lastError: error };
  }
}
