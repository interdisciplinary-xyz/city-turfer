/**
 * Deleting a profile's data on this phone ("Delete from this phone" after deleting the account),
 * so that it really goes: the profile id is written to a pending list first, then its database and
 * keychain items are erased, and only then is it taken off the list. A deletion that fails (expo-sqlite
 * refuses while a handle is still open) is retried on the next launch, or before that profile is
 * opened again. Profile ids only; nothing else is stored or logged.
 */

/** Port: where the pending list survives a restart (the keychain in the app). */
export interface PendingDeletionStore {
  read(): Promise<readonly string[]>;
  write(profileIds: readonly string[]): Promise<void>;
}

/** Port: erases one profile's database and its per-profile keychain items. Throws when it can't. */
export type ProfileEraser = (profileId: string) => Promise<void>;

export class ProfileDeletions {
  constructor(
    private readonly pending: PendingDeletionStore,
    private readonly erase: ProfileEraser
  ) {}

  /** Erases the profile now; on failure it stays on the list (and the error is thrown). */
  async delete(profileId: string): Promise<void> {
    await this.mark(profileId, true);
    await this.erase(profileId);
    await this.mark(profileId, false);
  }

  /**
   * Retries the deletions that failed before (launch). `except`: the profile signed in right now —
   * the Turfer opened it again after a failed deletion (that sign-in retried it first, see
   * `beforeOpening`), so it is no longer to be deleted. Never throws.
   */
  async retry(except: string | null = null): Promise<void> {
    for (const id of await this.pending.read().catch((): readonly string[] => [])) {
      if (id === except) {
        await this.mark(id, false).catch(() => undefined);
        continue;
      }
      await this.erase(id)
        .then(() => this.mark(id, false))
        .catch(() => undefined); // still pending: next launch
    }
  }

  /** Before a sign-in opens a profile: finish a deletion still pending for it. Never throws. */
  async beforeOpening(profileId: string): Promise<void> {
    if (!(await this.pending.read().catch((): readonly string[] => [])).includes(profileId)) {
      return;
    }
    await this.erase(profileId)
      .then(() => this.mark(profileId, false))
      .catch(() => undefined);
  }

  private async mark(profileId: string, on: boolean): Promise<void> {
    const ids = (await this.pending.read()).filter((x) => x !== profileId);
    await this.pending.write(on ? [...ids, profileId] : ids);
  }
}
