import { eq } from 'drizzle-orm';

import { authUsers, users } from '../db/schema';
import type { Db } from '../db/store';

export type AdoptResult = 'adopted' | 'already-adopted' | 'email-taken' | 'user-has-other-email';

/**
 * AdoptAccount (`auth:adopt`): lets an existing data user (e.g. `admin`, today's device-token user)
 * sign in with an e-mailed code by creating the Better Auth user with **that** id — no data is
 * copied. Creates the data user if it is missing. Refuses an e-mail that belongs to another account.
 */
export async function adopt(db: Db, id: string, email: string): Promise<AdoptResult> {
  return db.transaction(async (tx) => {
    const [byEmail] = await tx.select().from(authUsers).where(eq(authUsers.email, email));
    if (byEmail) {
      return byEmail.id === id ? 'already-adopted' : 'email-taken';
    }
    const [byId] = await tx.select().from(authUsers).where(eq(authUsers.id, id));
    if (byId) {
      return 'user-has-other-email';
    }
    await tx.insert(users).values({ id, email }).onConflictDoUpdate({ target: users.id, set: { email } });
    await tx.insert(authUsers).values({ id, email, emailVerified: true, name: '' });
    return 'adopted';
  });
}
