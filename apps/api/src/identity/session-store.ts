/** One row of `auth_sessions` as the session list needs it (no token, no IP, no user agent). */
export interface LiveSession {
  id: string;
  client: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

/**
 * Port: the user's sessions, read and revoked in the database (src/db/sessions.ts), not through
 * Better Auth's `listSessions` (at most 100 rows, unsorted, expired rows included). Every query is
 * scoped by `userId`; "live" means `expires_at` and any `absolute_expires_at` are after `now`
 * (the use cases' clock, not the database's).
 */
export interface SessionStore {
  /** Live sessions, most recently used first (`updated_at` desc, then `id`). */
  listLive(userId: string, now: number): Promise<LiveSession[]>;
  /** Deletes one live session of the user in one statement; false when it is not theirs, expired or gone. */
  revokeLive(userId: string, sessionId: string, now: number): Promise<boolean>;
  /** Deletes every session of the user, or every one but `keepSessionId`. */
  revokeAll(userId: string, keepSessionId?: string): Promise<void>;
}
