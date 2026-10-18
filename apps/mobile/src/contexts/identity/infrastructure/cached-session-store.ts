import type { SessionStore } from '../application/ports';
import type { UserId } from '../domain/user';

/**
 * Keeps the signed-in user id in memory, so the background location task does
 * not hit the keychain on every batch: a transient keychain error (device just
 * locked, keychain busy) must not look like "nobody is signed in".
 *
 * The cache is updated by sign-in (write) and sign-out (clear) through this
 * same instance. A read that finds nobody is not cached (cheap to retry); a
 * read that fails rejects and leaves the cache as it was.
 */
export class CachedSessionStore implements SessionStore {
  /** undefined: not known yet in this JS context. */
  private cached: UserId | null | undefined = undefined;

  constructor(private readonly inner: SessionStore) {}

  async read(): Promise<UserId | null> {
    if (this.cached !== undefined) return this.cached;
    const id = await this.inner.read();
    if (id) this.cached = id;
    return id;
  }

  async write(id: UserId): Promise<void> {
    this.cached = undefined; // never serve a stale id if the write fails half-way
    await this.inner.write(id);
    this.cached = id;
  }

  async clear(): Promise<void> {
    this.cached = undefined;
    await this.inner.clear();
    this.cached = null;
  }
}
