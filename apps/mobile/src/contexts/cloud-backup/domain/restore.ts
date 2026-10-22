import { DomainError } from '@/shared-kernel';

/** One Activity to bring back, as the server's manifest listed it. */
export interface RestoreItem {
  readonly activityId: string;
  readonly startedAt: number;
  readonly version: number;
}

export interface RestoreState {
  /** `idle`: never started (or nothing to do); `running`: started, maybe interrupted; `done`. */
  readonly status: 'idle' | 'running' | 'done';
  readonly total: number;
  readonly done: number;
  /** The Home City choice to apply at the end; null: none on the server. */
  readonly homeCity: { cityId: string | null; chosenAt: number } | null;
  readonly startedAt: number | null;
}

/**
 * Bringing a backup back onto this phone. Invariants: it starts once from the manifest (oldest
 * Activity first) and then only continues — a run killed half-way resumes with what is left, never
 * from scratch; it is finished only when every listed Activity was handled.
 */
export class Restore {
  private constructor(private state: RestoreState) {}

  static idle(): Restore {
    return new Restore({ status: 'idle', total: 0, done: 0, homeCity: null, startedAt: null });
  }

  static rehydrate(state: RestoreState): Restore {
    return new Restore(state);
  }

  toState(): RestoreState {
    return this.state;
  }

  get isRunning(): boolean {
    return this.state.status === 'running';
  }

  /** Orders the manifest's Activities oldest first. */
  start(items: readonly RestoreItem[], homeCity: RestoreState['homeCity'], now: number): RestoreItem[] {
    if (this.state.status === 'running') {
      throw new DomainError('restore.running');
    }
    const ordered = [...items].sort((a, b) => a.startedAt - b.startedAt || a.activityId.localeCompare(b.activityId));
    this.state = { status: 'running', total: ordered.length, done: 0, homeCity, startedAt: now };
    return ordered;
  }

  itemDone(): void {
    if (this.state.status !== 'running') {
      throw new DomainError('restore.not-running');
    }
    this.state = { ...this.state, done: Math.min(this.state.total, this.state.done + 1) };
  }

  /** Every listed Activity was handled (`left` is what the repository still holds). */
  finish(left: number): void {
    if (this.state.status !== 'running' || left > 0) {
      throw new DomainError('restore.not-finished');
    }
    this.state = { ...this.state, status: 'done', done: this.state.total };
  }
}

/**
 * What a restore may bring back: the manifest's Activities this phone lacks. An Activity on the
 * phone is skipped (never overwritten), and so is one the backup knows (`known`: it has a row for
 * it) but the phone no longer has: that one was deleted here, and a restore must not undo a delete.
 */
export function missingOnPhone(
  manifest: readonly RestoreItem[],
  onPhone: ReadonlySet<string>,
  known: ReadonlySet<string>
): RestoreItem[] {
  return manifest.filter((i) => !onPhone.has(i.activityId) && !known.has(i.activityId));
}

/**
 * Whether to offer a restore of `missing`: only while something in it is new to the Turfer, i.e.
 * not declined ("Not now") and not skipped by an earlier restore (content this version can't hold).
 */
export function worthOffering(missing: readonly RestoreItem[], declined: ReadonlySet<string>): boolean {
  return missing.some((i) => !declined.has(i.activityId));
}
