// Support: erases an account — the same EraseAccount use case as `DELETE /v1/me` (BackupService →
// DrizzleBackupStore.eraseAccount: the auth rows and pending codes, then everything hanging off
// users, export zips included). Dry run without --yes.
//   DATABASE_URL=… pnpm --filter @cityturfer/api run user:delete -- <userId>          # dry run
//   DATABASE_URL=… pnpm --filter @cityturfer/api run user:delete -- <userId> --yes    # erase
// Takes the id only (find it with user:find), so a typo in an e-mail cannot pick another account.
// Runbook: docs/operations/api-deploy.md ("Support requests").
import { BackupService } from '../src/backup/use-cases';
import { DrizzleBackupStore } from '../src/db/store';
import { findAccount } from '../src/db/support';
import { openDb } from './open-db';

const args = process.argv.slice(2).filter((a) => a !== '--');
const yes = args.includes('--yes');
const [userId] = args.filter((a) => a !== '--yes');
if (!userId || !/^[A-Za-z0-9_-]{1,64}$/.test(userId) || args.length > (yes ? 2 : 1)) {
  console.error('Usage: pnpm --filter @cityturfer/api run user:delete -- <userId> [--yes]');
  process.exit(1);
}

const { db, close, where } = await openDb();
try {
  const account = await findAccount(db, userId);
  if (!account || account.id !== userId) {
    console.error(`No account with id ${userId} (${where}). Nothing deleted.`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(account, null, 2));
    if (!yes) {
      console.log(`Dry run (${where}): this account and all its data would be erased. Add --yes to erase it.`);
    } else {
      await new BackupService(new DrizzleBackupStore(db), { now: () => Date.now() }).eraseAccount(userId);
      const left = await findAccount(db, userId);
      console.log(left ? 'Erase failed: the account is still there.' : `Erased account ${userId} (${where}).`);
      // A warm function still "knows" the user (one upsert per cold start): the redeploy resets that.
      console.log('If it has a device token, remove its hash from API_TOKENS and redeploy.');
      process.exitCode = left ? 1 : 0;
    }
  }
} catch (error) {
  console.error(`Delete failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await close();
}
