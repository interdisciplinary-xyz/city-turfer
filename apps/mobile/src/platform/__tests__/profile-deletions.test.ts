import { type PendingDeletionStore, ProfileDeletions } from '../profile-deletions';

/** A phone's profiles (databases + keychain items) and the pending list, in memory. */
function setup() {
  const profiles = new Set(['admin', 'a-acct-1']);
  let pending: readonly string[] = [];
  const state = { failing: false };
  const store: PendingDeletionStore = {
    read: async () => pending,
    write: async (ids) => void (pending = ids),
  };
  const deletions = new ProfileDeletions(store, async (id) => {
    if (state.failing) {
      throw new Error('database is still open');
    }
    profiles.delete(id);
  });
  return { profiles, pending: () => pending, state, deletions };
}

describe('ProfileDeletions', () => {
  it('erases the profile and leaves nothing pending', async () => {
    const t = setup();
    await t.deletions.delete('admin');
    expect([...t.profiles]).toEqual(['a-acct-1']);
    expect(t.pending()).toEqual([]);
  });

  it('a failed deletion is reported, kept, and finished on the next launch', async () => {
    const t = setup();
    t.state.failing = true;
    await expect(t.deletions.delete('admin')).rejects.toThrow('still open');
    expect(t.profiles.has('admin')).toBe(true);
    expect(t.pending()).toEqual(['admin']);

    await t.deletions.retry(); // the next launch, still failing: stays pending, never throws
    expect(t.pending()).toEqual(['admin']);

    t.state.failing = false;
    await t.deletions.retry();
    expect(t.profiles.has('admin')).toBe(false);
    expect(t.pending()).toEqual([]);
  });

  it('signing in to that profile before the next launch finishes the deletion first', async () => {
    const t = setup();
    t.state.failing = true;
    await expect(t.deletions.delete('admin')).rejects.toThrow();
    t.state.failing = false;
    await t.deletions.beforeOpening('a-acct-1'); // another profile: untouched
    expect(t.profiles.has('a-acct-1')).toBe(true);
    await t.deletions.beforeOpening('admin');
    expect(t.profiles.has('admin')).toBe(false);
    expect(t.pending()).toEqual([]);
  });

  it('a profile signed in again (its deletion retried at that sign-in) is no longer deleted at launch', async () => {
    const t = setup();
    t.state.failing = true;
    await expect(t.deletions.delete('admin')).rejects.toThrow();
    await t.deletions.beforeOpening('admin'); // fails again; the Turfer uses the profile now
    t.state.failing = false;
    await t.deletions.retry('admin');
    expect(t.profiles.has('admin')).toBe(true);
    expect(t.pending()).toEqual([]);
  });
});
