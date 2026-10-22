import { type SessionStore, type UserId, userId } from '@cityturfer/core/identity/ports';

import { CachedSessionStore } from '../cached-session-store';

/** A keychain stand-in that can fail on demand. */
function flakyStore(initial: UserId | null) {
  let id = initial;
  const s = {
    reads: 0,
    failReads: false,
    failWrites: false,
    read: async () => {
      s.reads++;
      if (s.failReads) {
        throw new Error('errSecInteractionNotAllowed');
      }
      return id;
    },
    write: async (v: UserId) => {
      if (s.failWrites) {
        throw new Error('keychain busy');
      }
      id = v;
    },
    clear: async () => void (id = null),
  };
  return s satisfies SessionStore;
}

const ADMIN = userId('admin');

describe('CachedSessionStore', () => {
  it('reads the keychain once, then serves the signed-in uid from memory', async () => {
    const inner = flakyStore(ADMIN);
    const store = new CachedSessionStore(inner);
    expect(await store.read()).toBe(ADMIN);
    inner.failReads = true; // e.g. the device locked
    expect(await store.read()).toBe(ADMIN);
    expect(inner.reads).toBe(1);
  });

  it('a read error rejects (is not "nobody signed in") and is retried next time', async () => {
    const inner = flakyStore(ADMIN);
    inner.failReads = true;
    const store = new CachedSessionStore(inner);
    await expect(store.read()).rejects.toThrow('errSecInteractionNotAllowed');
    inner.failReads = false;
    expect(await store.read()).toBe(ADMIN);
  });

  it('does not cache "nobody" from a read', async () => {
    const inner = flakyStore(null);
    const store = new CachedSessionStore(inner);
    expect(await store.read()).toBeNull();
    await inner.write(ADMIN); // signed in from elsewhere
    expect(await store.read()).toBe(ADMIN);
  });

  it('sign-in and sign-out update the cache', async () => {
    const inner = flakyStore(null);
    const store = new CachedSessionStore(inner);
    await store.write(ADMIN);
    inner.failReads = true;
    expect(await store.read()).toBe(ADMIN);
    await store.clear();
    expect(await store.read()).toBeNull();
    expect(inner.reads).toBe(0);
  });

  it('a failed write leaves nothing stale in the cache', async () => {
    const inner = flakyStore(null);
    const store = new CachedSessionStore(inner);
    inner.failWrites = true;
    await expect(store.write(ADMIN)).rejects.toThrow('keychain busy');
    expect(await store.read()).toBeNull();
  });
});
