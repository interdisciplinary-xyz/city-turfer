import { count, eq, max, sql } from 'drizzle-orm';

import { activities, authSessions, authUsers, consents, dataExports, tombstones, users } from './schema';
import type { Db } from './store';

/**
 * Support without an admin panel (`user:find`, `user:delete` in apps/api/scripts/): what an operator
 * may see of an account to answer a request — ids, e-mail, counts, times and consents. Never
 * coordinates, tracks, names of activities, the Home City or tokens.
 */
export interface AccountSummary {
  id: string;
  /** `users.email` (from the device token config or sign-in). */
  email: string | null;
  /** The e-mail it signs in with (`auth_users`), when it has one. */
  signInEmail: string | null;
  createdAt: string;
  activities: number;
  tombstones: number;
  /** Latest `endedAt` of its activities. */
  lastActivityAt: string | null;
  /** Latest upload or change of an activity on the server. */
  lastUploadAt: string | null;
  sessions: number;
  exports: number;
  consents: { purpose: string; granted: boolean; policyVersion: string; decidedAt: string }[];
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** The account whose id is `query`, else the one with that e-mail (either column); null if none. */
export async function findAccount(db: Db, query: string): Promise<AccountSummary | null> {
  const q = query.trim();
  const email = q.toLowerCase();
  const [byId] = await db.select({ id: users.id }).from(users).where(eq(users.id, q));
  const [byAuthId] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, q));
  let id = byId?.id ?? byAuthId?.id;
  if (!id) {
    const [byUserEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`);
    const [byAuthEmail] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email));
    id = byAuthEmail?.id ?? byUserEmail?.id;
  }
  if (!id) {
    return null;
  }
  // Either row may be missing: a device-token user has no `auth_users` row, and a sign-in account
  // gets its `users` row on its first data request.
  const [user] = await db.select().from(users).where(eq(users.id, id));
  const [auth] = await db
    .select({ email: authUsers.email, createdAt: authUsers.createdAt })
    .from(authUsers)
    .where(eq(authUsers.id, id));
  const [acts] = await db
    .select({ n: count(), lastEnded: max(activities.endedAt), lastUpdated: max(activities.updatedAt) })
    .from(activities)
    .where(eq(activities.userId, id));
  const [tombs] = await db.select({ n: count() }).from(tombstones).where(eq(tombstones.userId, id));
  const [sessions] = await db.select({ n: count() }).from(authSessions).where(eq(authSessions.userId, id));
  const [exps] = await db.select({ n: count() }).from(dataExports).where(eq(dataExports.userId, id));
  const decisions = await db.select().from(consents).where(eq(consents.userId, id)).orderBy(consents.purpose);
  return {
    id,
    email: user?.email ?? null,
    signInEmail: auth?.email ?? null,
    createdAt: (user?.createdAt ?? auth?.createdAt ?? new Date(0)).toISOString(),
    activities: Number(acts?.n ?? 0),
    tombstones: Number(tombs?.n ?? 0),
    lastActivityAt: iso(acts?.lastEnded),
    lastUploadAt: iso(acts?.lastUpdated),
    sessions: Number(sessions?.n ?? 0),
    exports: Number(exps?.n ?? 0),
    consents: decisions.map((c) => ({
      purpose: c.purpose,
      granted: c.granted,
      policyVersion: c.policyVersion,
      decidedAt: c.decidedAt.toISOString(),
    })),
  };
}
