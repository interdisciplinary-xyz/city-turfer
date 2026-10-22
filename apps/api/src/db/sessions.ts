import { and, desc, eq, gt, isNull, ne, or } from 'drizzle-orm';

import type { LiveSession, SessionStore } from '../identity/session-store';
import { authSessions } from './schema';
import type { Db } from './store';

/** `auth_sessions` through Drizzle (Better Auth writes the rows; we only list and delete them here). */
export class DrizzleSessionStore implements SessionStore {
  constructor(private readonly db: Db) {}

  async listLive(userId: string, now: number): Promise<LiveSession[]> {
    const rows = await this.db
      .select({
        id: authSessions.id,
        client: authSessions.client,
        createdAt: authSessions.createdAt,
        updatedAt: authSessions.updatedAt,
        expiresAt: authSessions.expiresAt,
      })
      .from(authSessions)
      .where(and(eq(authSessions.userId, userId), live(now)))
      .orderBy(desc(authSessions.updatedAt), authSessions.id);
    return rows.map((r) => ({
      id: r.id,
      client: r.client,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
      expiresAt: r.expiresAt.getTime(),
    }));
  }

  async revokeLive(userId: string, sessionId: string, now: number): Promise<boolean> {
    const deleted = await this.db
      .delete(authSessions)
      .where(and(eq(authSessions.userId, userId), eq(authSessions.id, sessionId), live(now)))
      .returning({ id: authSessions.id });
    return deleted.length > 0;
  }

  async revokeAll(userId: string, keepSessionId?: string): Promise<void> {
    await this.db
      .delete(authSessions)
      .where(
        keepSessionId
          ? and(eq(authSessions.userId, userId), ne(authSessions.id, keepSessionId))
          : eq(authSessions.userId, userId)
      );
  }
}

function live(now: number) {
  const at = new Date(now);
  return and(
    gt(authSessions.expiresAt, at),
    or(isNull(authSessions.absoluteExpiresAt), gt(authSessions.absoluteExpiresAt, at))
  );
}
