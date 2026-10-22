// Support: looks an account up by id or e-mail and prints what support may see — id, e-mails,
// createdAt, counts, last activity time, consents. No coordinates, tracks or activity names.
//   DATABASE_URL=… pnpm --filter @cityturfer/api run user:find -- <userId|email>
// Runbook: docs/operations/api-deploy.md ("Support requests").
import { findAccount } from '../src/db/support';
import { openDb } from './open-db';

const [query] = process.argv.slice(2).filter((a) => a !== '--');
if (!query?.trim()) {
  console.error('Usage: pnpm --filter @cityturfer/api run user:find -- <userId|email>');
  process.exit(1);
}

const { db, close, where } = await openDb();
try {
  const account = await findAccount(db, query);
  if (account) {
    console.log(JSON.stringify(account, null, 2));
  } else {
    console.error(`No account with that id or e-mail (${where}).`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Lookup failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await close();
}
