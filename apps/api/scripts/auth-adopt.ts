// Lets an existing data user (e.g. `admin`, today's device-token user) sign in with an e-mail code,
// without copying any data: the Better Auth user is created with that user's id.
//   DATABASE_URL=… pnpm --filter @cityturfer/api run auth:adopt -- admin founder@example.com
// Without DATABASE_URL it works on the local dev server's PGlite (apps/api/.data/pglite; stop the
// dev server first). Refuses when the e-mail already belongs to another account. Prints no
// connection details.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { createNeonDb } from '../src/db/neon';
import { createPgliteDb } from '../src/db/pglite';
import type { Db } from '../src/db/store';
import { adopt, type AdoptResult } from '../src/identity/adopt';

const [userId, rawEmail] = process.argv.slice(2).filter((a) => a !== '--');
const email = rawEmail?.trim().toLowerCase();
if (!userId || !/^[A-Za-z0-9_-]{1,64}$/.test(userId) || !email || !z.email().safeParse(email).success) {
  console.error('Usage: pnpm --filter @cityturfer/api run auth:adopt -- <existingUserId> <email>');
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
let db: Db;
let close: () => Promise<void>;
if (url) {
  ({ db, close } = createNeonDb(url));
} else {
  const dataDir = path.join(import.meta.dirname, '..', '.data', 'pglite');
  mkdirSync(dataDir, { recursive: true });
  ({ db, close } = await createPgliteDb(dataDir));
}
try {
  const result = await adopt(db, userId, email);
  const messages: Record<AdoptResult, string> = {
    adopted: `User ${userId} now signs in with that e-mail (a code is sent on request).`,
    'already-adopted': `User ${userId} already signs in with that e-mail.`,
    'email-taken': 'That e-mail already belongs to another account: delete that account first.',
    'user-has-other-email': `User ${userId} already signs in with another e-mail.`,
  };
  console.log(messages[result]);
  process.exitCode = result === 'adopted' || result === 'already-adopted' ? 0 : 1;
} catch (error) {
  console.error(`Adopt failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await close();
}
