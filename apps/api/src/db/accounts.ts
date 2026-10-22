import { randomUUID } from 'node:crypto';

import { and, eq, like, ne, or } from 'drizzle-orm';

import type { AccountRepository } from '../identity/account';
import { emailChangePrefix } from '../identity/codes';
import type { SignInStamp, SignInStamps } from '../identity/use-cases';
import { authAccounts, authSessions, authUsers, authVerifications, users } from './schema';
import type { Db } from './store';

/** Better Auth's provider id of a password (`auth_accounts`, account id = user id). */
const CREDENTIAL = 'credential';

/** A LIKE pattern matching `text` literally. */
const literal = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const isCredential = (userId: string) =>
  and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, CREDENTIAL), eq(authAccounts.accountId, userId));

/** Postgres unique violation (Drizzle wraps the driver's error in `cause`). */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return code(error) === '23505' || code((error as { cause?: unknown } | null)?.cause) === '23505';
}

/**
 * AccountRepository (and the sign-in stamps) on Postgres: the Better Auth tables beside `users`
 * (src/db/schema.ts).
 */
export class DrizzleAccountRepository implements AccountRepository, SignInStamps {
  constructor(private readonly db: Db) {}

  byEmail(email: string): Promise<SignInStamp | null> {
    return this.stamp(eq(authUsers.email, email));
  }

  byUser(userId: string): Promise<SignInStamp | null> {
    return this.stamp(eq(authUsers.id, userId));
  }

  /** One query: the user and its password credential (left join). */
  private async stamp(where: ReturnType<typeof eq>): Promise<SignInStamp | null> {
    const [row] = await this.db
      .select({ userId: authUsers.id, email: authUsers.email, password: authAccounts.password })
      .from(authUsers)
      .leftJoin(
        authAccounts,
        and(
          eq(authAccounts.userId, authUsers.id),
          eq(authAccounts.providerId, CREDENTIAL),
          eq(authAccounts.accountId, authUsers.id)
        )
      )
      .where(where);
    return row ? { userId: row.userId, email: row.email, password: row.password ?? null } : null;
  }

  async credential(userId: string): Promise<{ changedAt: number } | null> {
    const [row] = await this.db
      .select({ password: authAccounts.password, updatedAt: authAccounts.updatedAt })
      .from(authAccounts)
      .where(isCredential(userId));
    return row?.password ? { changedAt: row.updatedAt.getTime() } : null;
  }

  async rename(userId: string, name: string | null, at: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ displayName: name }).where(eq(users.id, userId));
      await tx
        .update(authUsers)
        .set({ name: name ?? '', updatedAt: new Date(at) })
        .where(eq(authUsers.id, userId));
    });
  }

  async emailTaken(email: string, exceptUserId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(and(eq(authUsers.email, email), ne(authUsers.id, exceptUserId)));
    return !!row;
  }

  async changeEmail(input: {
    userId: string;
    from: string;
    to: string;
    keepSessionToken: string;
    at: number;
  }): Promise<'changed' | 'taken'> {
    const { userId, from, to, keepSessionToken, at } = input;
    try {
      return await this.db.transaction(async (tx) => {
        const [taken] = await tx
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(and(eq(authUsers.email, to), ne(authUsers.id, userId)));
        if (taken) {
          return 'taken' as const;
        }
        await tx
          .update(authUsers)
          .set({ email: to, emailVerified: true, updatedAt: new Date(at) })
          .where(eq(authUsers.id, userId));
        await tx.update(users).set({ email: to }).where(eq(users.id, userId));
        // Pending codes keyed `<type>-otp-<address>` for either address (a sign-in code mailed to the
        // new address would now open this account), and every pending new-address code of the user.
        await tx
          .delete(authVerifications)
          .where(
            or(
              like(authVerifications.identifier, `%-otp-${literal(from)}`),
              like(authVerifications.identifier, `%-otp-${literal(to)}`),
              like(authVerifications.identifier, `${literal(emailChangePrefix(userId))}%`)
            )
          );
        await tx
          .delete(authSessions)
          .where(and(eq(authSessions.userId, userId), ne(authSessions.token, keepSessionToken)));
        return 'changed' as const;
      });
    } catch (error) {
      // Another account took the address between the check and the update (auth_users.email is unique).
      if (isUniqueViolation(error)) {
        return 'taken';
      }
      throw error;
    }
  }

  async setPassword(input: {
    userId: string;
    hash: string;
    keepSessionToken: string;
    at: number;
  }): Promise<'set' | 'changed'> {
    const { userId, hash, keepSessionToken, at } = input;
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: authAccounts.id, password: authAccounts.password })
        .from(authAccounts)
        .where(isCredential(userId))
        .for('update');
      if (existing) {
        await tx
          .update(authAccounts)
          .set({ password: hash, updatedAt: new Date(at) })
          .where(eq(authAccounts.id, existing.id));
      } else {
        await tx.insert(authAccounts).values({
          id: randomUUID(),
          userId,
          providerId: CREDENTIAL,
          accountId: userId,
          password: hash,
          createdAt: new Date(at),
          updatedAt: new Date(at),
        });
      }
      await tx
        .delete(authSessions)
        .where(and(eq(authSessions.userId, userId), ne(authSessions.token, keepSessionToken)));
      return existing?.password ? ('changed' as const) : ('set' as const);
    });
  }

  async removePassword(input: { userId: string; keepSessionToken: string }): Promise<boolean> {
    const { userId, keepSessionToken } = input;
    return this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(authAccounts)
        .where(isCredential(userId))
        .returning({ password: authAccounts.password });
      await tx
        .delete(authSessions)
        .where(and(eq(authSessions.userId, userId), ne(authSessions.token, keepSessionToken)));
      return removed.some((r) => r.password);
    });
  }
}
